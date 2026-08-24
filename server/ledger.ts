// The ledger: purchase lots (`holdings`) and sales (`sales`) are the source of
// truth; what is still held, and what each sale earned, is derived here by
// replaying both chronologically per account × ticker, consuming the oldest
// lots first (FIFO). Deriving instead of storing means correcting an old
// purchase price re-computes every later sale's realized P/L for free.

import { getDb } from "./db";
import type { Holding, Sale } from "../src/types/api";

/** Quantities closer than this are treated as equal (floating-point lots). */
export const QTY_EPSILON = 1e-9;

export type HoldingWithAccount = Holding & { accountName: string };
export type SaleWithAccount = Sale & { accountName: string };

export type OpenLot = HoldingWithAccount & {
  /** Shares of the lot not yet sold. */
  remaining: number;
};

export type SettledSale = SaleWithAccount & {
  /** Cost of the lots this sale consumed, in the sale's currency. */
  costBasis: number;
  matchedQuantity: number;
  /** Shares no earlier purchase could cover — a ledger inconsistency. */
  unmatchedQuantity: number;
  /** matchedQuantity × price − costBasis. */
  realizedPl: number;
};

type LotRow = {
  id: number;
  ticker: string;
  account_id: number;
  account_name: string;
  quantity: number;
  purchase_price: number;
  purchased_at: string | null;
};

type SaleRow = {
  id: number;
  ticker: string;
  account_id: number;
  account_name: string;
  quantity: number;
  price: number;
  currency: string;
  eur_per_unit: number | null;
  cash_credited: number | null;
  reason: string;
  sold_at: string;
};

export function listHoldings(): HoldingWithAccount[] {
  const rows = getDb()
    .prepare(
      `SELECT h.id, h.ticker, h.account_id, a.name AS account_name,
              h.quantity, h.purchase_price, h.purchased_at
       FROM holdings h JOIN accounts a ON a.id = h.account_id
       ORDER BY h.ticker, a.name COLLATE NOCASE, h.purchased_at, h.id`,
    )
    .all() as LotRow[];
  return rows.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    accountId: row.account_id,
    accountName: row.account_name,
    quantity: row.quantity,
    purchasePrice: row.purchase_price,
    purchasedAt: row.purchased_at,
  }));
}

export function listSales(): SaleWithAccount[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.ticker, s.account_id, a.name AS account_name, s.quantity, s.price,
              s.currency, s.eur_per_unit, s.cash_credited, s.reason, s.sold_at
       FROM sales s JOIN accounts a ON a.id = s.account_id
       ORDER BY s.sold_at, s.id`,
    )
    .all() as SaleRow[];
  return rows.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    accountId: row.account_id,
    accountName: row.account_name,
    quantity: row.quantity,
    price: row.price,
    currency: row.currency,
    eurPerUnit: row.eur_per_unit,
    cashCredited: row.cash_credited,
    reason: row.reason,
    soldAt: row.sold_at,
  }));
}

type Event =
  | { kind: "buy"; date: string; id: number; lot: HoldingWithAccount }
  | { kind: "sell"; date: string; id: number; sale: SaleWithAccount };

/**
 * Replays buys and sales per account × ticker in date order (undated lots
 * count as oldest; on the same day a purchase precedes a sale) and consumes
 * lots oldest-first.
 */
export function replayLedger(
  buys: HoldingWithAccount[],
  sales: SaleWithAccount[],
): { openLots: OpenLot[]; settledSales: SettledSale[] } {
  const groups = new Map<string, Event[]>();
  const push = (key: string, event: Event) => {
    const list = groups.get(key);
    if (list) list.push(event);
    else groups.set(key, [event]);
  };
  for (const lot of buys) {
    push(`${lot.accountId}:${lot.ticker}`, { kind: "buy", date: lot.purchasedAt ?? "", id: lot.id, lot });
  }
  for (const sale of sales) {
    push(`${sale.accountId}:${sale.ticker}`, { kind: "sell", date: sale.soldAt, id: sale.id, sale });
  }

  const openLots: OpenLot[] = [];
  const settledSales: SettledSale[] = [];

  for (const events of groups.values()) {
    events.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.kind === b.kind ? 0 : a.kind === "buy" ? -1 : 1) ||
        a.id - b.id,
    );
    const lots: OpenLot[] = [];
    for (const event of events) {
      if (event.kind === "buy") {
        lots.push({ ...event.lot, remaining: event.lot.quantity });
        continue;
      }
      const sale = event.sale;
      let need = sale.quantity;
      let costBasis = 0;
      for (const lot of lots) {
        if (need <= QTY_EPSILON) break;
        if (lot.remaining <= QTY_EPSILON) continue;
        const take = Math.min(need, lot.remaining);
        lot.remaining -= take;
        costBasis += take * lot.purchasePrice;
        need -= take;
      }
      const unmatched = need > QTY_EPSILON ? need : 0;
      const matched = sale.quantity - unmatched;
      settledSales.push({
        ...sale,
        costBasis,
        matchedQuantity: matched,
        unmatchedQuantity: unmatched,
        realizedPl: matched * sale.price - costBasis,
      });
    }
    for (const lot of lots) {
      if (lot.remaining > QTY_EPSILON) openLots.push(lot);
    }
  }

  return { openLots, settledSales };
}

function formatQuantity(value: number): string {
  return Number(value.toFixed(4)).toString();
}

/**
 * Throws when, given these buys and sales, some sale would have no purchase
 * to draw on — used before any change that removes or shrinks lots.
 */
export function assertLedgerConsistent(buys: HoldingWithAccount[], sales: SaleWithAccount[]): void {
  const { settledSales } = replayLedger(buys, sales);
  const broken = settledSales.find((s) => s.unmatchedQuantity > QTY_EPSILON);
  if (broken) {
    throw new Error(
      `That would leave ${formatQuantity(broken.unmatchedQuantity)} ${broken.ticker} shares sold from ${broken.accountName} on ${broken.soldAt} without a matching purchase — edit or delete that sale first`,
    );
  }
}

/** Shares of `ticker` available in `accountId` for a sale on `date`, given the ledger. */
export function availableQuantity(
  buys: HoldingWithAccount[],
  sales: SaleWithAccount[],
  accountId: number,
  ticker: string,
  date: string,
): number {
  // A hypothetical sale of "everything" on that date: whatever it can match is available.
  const probe: SaleWithAccount = {
    id: Number.MAX_SAFE_INTEGER,
    ticker,
    accountId,
    accountName: "",
    quantity: Number.MAX_SAFE_INTEGER,
    price: 0,
    currency: "",
    eurPerUnit: null,
    cashCredited: null,
    reason: "",
    soldAt: date,
  };
  const { settledSales } = replayLedger(buys, [...sales, probe]);
  return settledSales.find((s) => s.id === probe.id)?.matchedQuantity ?? 0;
}
