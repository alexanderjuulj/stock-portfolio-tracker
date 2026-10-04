// CRUD + validation for holdings — purchase lots. A lot belongs to exactly
// one account and one stock; the same ticker can appear in many accounts and
// several times within one. Lots keep their bought quantity forever; sales
// are applied on top by server/ledger.ts, which is also consulted before a
// lot is shrunk, moved or deleted so no sale is left without its purchase.
// A lot can be paid from its account's free cash: the cost, converted to the
// account's currency, is debited and remembered in `cash_debited` so editing
// or deleting the lot re-applies / gives back exactly that amount.

import { accountExists } from "./accounts";
import { getDb, inTransaction } from "./db";
import { assertLedgerConsistent, listHoldings, listSales, type HoldingWithAccount } from "./ledger";
import { getFxToEur, getQuotes } from "./quotes";
import {
  deleteOrphanStocks,
  getStock,
  normalizeTicker,
  parseStockInput,
  upsertStock,
} from "./stocks";
import type { Holding, HoldingInput } from "../src/types/api";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Throws with a user-facing message; route handlers turn that into a 400. */
export function parseHoldingInput(body: unknown): HoldingInput {
  if (typeof body !== "object" || body === null) throw new Error("Expected a JSON object");
  const b = body as Record<string, unknown>;

  const ticker = typeof b.ticker === "string" ? normalizeTicker(b.ticker) : "";
  if (!ticker) throw new Error("Ticker is required");

  const accountId = typeof b.accountId === "number" ? b.accountId : NaN;
  if (!Number.isInteger(accountId)) throw new Error("Account is required");

  const quantity = typeof b.quantity === "number" ? b.quantity : NaN;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a number greater than 0");
  }

  const purchasePrice = typeof b.purchasePrice === "number" ? b.purchasePrice : NaN;
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
    throw new Error("Purchase price must be a non-negative number");
  }

  let purchasedAt: string | null = null;
  if (typeof b.purchasedAt === "string" && b.purchasedAt.trim() !== "") {
    purchasedAt = b.purchasedAt.trim();
    if (!isValidDate(purchasedAt)) throw new Error("Purchase date must be a valid YYYY-MM-DD date");
  }

  return {
    ticker,
    accountId,
    quantity,
    purchasePrice,
    purchasedAt,
    stock: b.stock === undefined || b.stock === null ? undefined : parseStockInput(b.stock),
    debitCash: b.debitCash === true,
  };
}

function toHolding(id: number, input: HoldingInput, cashDebited: number | null): Holding {
  return {
    id,
    ticker: input.ticker,
    accountId: input.accountId,
    quantity: input.quantity,
    purchasePrice: input.purchasePrice,
    purchasedAt: input.purchasedAt,
    cashDebited,
  };
}

/**
 * What the lot costs in its account's currency, or null when it isn't paid
 * from free cash. The trading currency is the quote's when the provider
 * reports one (as everywhere else), else the stock's fallback currency.
 */
async function cashDebitFor(input: HoldingInput): Promise<number | null> {
  if (!input.debitCash) return null;
  const account = getDb().prepare("SELECT currency FROM accounts WHERE id = ?").get(input.accountId) as
    | { currency: string }
    | undefined;
  if (!account) throw new Error("Account not found");

  const { quotes } = await getQuotes([input.ticker], false);
  const currency =
    quotes.get(input.ticker)?.currency ??
    input.stock?.currency ??
    getStock(input.ticker)?.currency ??
    account.currency;
  const cost = input.quantity * input.purchasePrice;
  if (currency === account.currency) return cost;

  const { rates } = await getFxToEur([currency, account.currency], false);
  const from = rates.get(currency);
  const to = rates.get(account.currency);
  if (from === undefined || to === undefined) {
    throw new Error(
      `Can't convert ${currency} to ${account.currency} — no exchange rate. Untick "pay from free cash" or try again later`,
    );
  }
  return (cost * from) / to;
}

function adjustCash(accountId: number, delta: number): void {
  if (delta !== 0) getDb().prepare("UPDATE accounts SET cash = cash + ? WHERE id = ?").run(delta, accountId);
}

function accountName(id: number): string {
  const row = getDb().prepare("SELECT name FROM accounts WHERE id = ?").get(id) as
    | { name: string }
    | undefined;
  return row?.name ?? "";
}

export async function createHolding(input: HoldingInput): Promise<Holding> {
  if (!accountExists(input.accountId)) throw new Error("Account not found");
  const cashDebited = await cashDebitFor(input);
  return inTransaction(() => {
    upsertStock(input.ticker, input.stock);
    const result = getDb()
      .prepare(
        `INSERT INTO holdings (ticker, account_id, quantity, purchase_price, purchased_at, cash_debited)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(input.ticker, input.accountId, input.quantity, input.purchasePrice, input.purchasedAt, cashDebited);
    if (cashDebited !== null) adjustCash(input.accountId, -cashDebited);
    return toHolding(Number(result.lastInsertRowid), input, cashDebited);
  });
}

/**
 * Updates a lot (and, when `stock` is given, the stock fields shared by all
 * its lots). Changing the ticker moves the lot to that stock — created on the
 * fly, inheriting the old stock's fields unless `stock` is given — and drops
 * the old stock record if nothing else refers to it. Any cash the lot took is
 * given back to its old account and the new cost (if paid from free cash)
 * taken from the new one. Refused when a recorded sale would be left without
 * its purchase.
 */
export async function updateHolding(id: number, input: HoldingInput): Promise<Holding | null> {
  const db = getDb();
  const current = db
    .prepare("SELECT ticker, account_id, cash_debited FROM holdings WHERE id = ?")
    .get(id) as { ticker: string; account_id: number; cash_debited: number | null } | undefined;
  if (!current) return null;
  if (!accountExists(input.accountId)) throw new Error("Account not found");

  const after: HoldingWithAccount = {
    ...toHolding(id, input, null),
    accountName: accountName(input.accountId),
  };
  assertLedgerConsistent(
    listHoldings().map((lot) => (lot.id === id ? after : lot)),
    listSales(),
  );
  const cashDebited = await cashDebitFor(input);
  return inTransaction(() => {
    if (input.ticker !== current.ticker) {
      const previous = getStock(current.ticker);
      upsertStock(
        input.ticker,
        input.stock ??
          (previous
            ? { sector: previous.sector, currency: previous.currency, notes: previous.notes }
            : undefined),
      );
    } else if (input.stock) {
      upsertStock(input.ticker, input.stock);
    }

    db.prepare(
      `UPDATE holdings SET ticker = ?, account_id = ?, quantity = ?, purchase_price = ?, purchased_at = ?,
         cash_debited = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).run(input.ticker, input.accountId, input.quantity, input.purchasePrice, input.purchasedAt, cashDebited, id);
    adjustCash(current.account_id, current.cash_debited ?? 0);
    adjustCash(input.accountId, -(cashDebited ?? 0));

    if (input.ticker !== current.ticker) deleteOrphanStocks();
    return toHolding(id, input, cashDebited);
  });
}

/**
 * Gives back the cash the lot was paid with. Refused when a recorded sale
 * would be left without its purchase.
 */
export function deleteHolding(id: number): boolean {
  const lots = listHoldings();
  const lot = lots.find((l) => l.id === id);
  if (!lot) return false;
  assertLedgerConsistent(
    lots.filter((l) => l.id !== id),
    listSales(),
  );
  inTransaction(() => {
    getDb().prepare("DELETE FROM holdings WHERE id = ?").run(id);
    if (lot.cashDebited !== null) adjustCash(lot.accountId, lot.cashDebited);
    deleteOrphanStocks();
  });
  return true;
}
