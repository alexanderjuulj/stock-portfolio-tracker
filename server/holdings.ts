// CRUD + validation for holdings — purchase lots. A lot belongs to exactly
// one account and one stock; the same ticker can appear in many accounts and
// several times within one. Lots keep their bought quantity forever; sales
// are applied on top by server/ledger.ts, which is also consulted before a
// lot is shrunk, moved or deleted so no sale is left without its purchase.

import { accountExists } from "./accounts";
import { getDb } from "./db";
import { assertLedgerConsistent, listHoldings, listSales, type HoldingWithAccount } from "./ledger";
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
  };
}

function toHolding(id: number, input: HoldingInput): Holding {
  return {
    id,
    ticker: input.ticker,
    accountId: input.accountId,
    quantity: input.quantity,
    purchasePrice: input.purchasePrice,
    purchasedAt: input.purchasedAt,
  };
}

function accountName(id: number): string {
  const row = getDb().prepare("SELECT name FROM accounts WHERE id = ?").get(id) as
    | { name: string }
    | undefined;
  return row?.name ?? "";
}

export function createHolding(input: HoldingInput): Holding {
  if (!accountExists(input.accountId)) throw new Error("Account not found");
  upsertStock(input.ticker, input.stock);
  const result = getDb()
    .prepare(
      "INSERT INTO holdings (ticker, account_id, quantity, purchase_price, purchased_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.ticker, input.accountId, input.quantity, input.purchasePrice, input.purchasedAt);
  return toHolding(Number(result.lastInsertRowid), input);
}

/**
 * Updates a lot (and, when `stock` is given, the stock fields shared by all
 * its lots). Changing the ticker moves the lot to that stock — created on the
 * fly, inheriting the old stock's fields unless `stock` is given — and drops
 * the old stock record if nothing else refers to it. Refused when a recorded
 * sale would be left without its purchase.
 */
export function updateHolding(id: number, input: HoldingInput): Holding | null {
  const db = getDb();
  const current = db.prepare("SELECT ticker FROM holdings WHERE id = ?").get(id) as
    | { ticker: string }
    | undefined;
  if (!current) return null;
  if (!accountExists(input.accountId)) throw new Error("Account not found");

  const after: HoldingWithAccount = { ...toHolding(id, input), accountName: accountName(input.accountId) };
  assertLedgerConsistent(
    listHoldings().map((lot) => (lot.id === id ? after : lot)),
    listSales(),
  );

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
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(input.ticker, input.accountId, input.quantity, input.purchasePrice, input.purchasedAt, id);

  if (input.ticker !== current.ticker) deleteOrphanStocks();
  return toHolding(id, input);
}

/** Refused when a recorded sale would be left without its purchase. */
export function deleteHolding(id: number): boolean {
  const lots = listHoldings();
  if (!lots.some((lot) => lot.id === id)) return false;
  assertLedgerConsistent(
    lots.filter((lot) => lot.id !== id),
    listSales(),
  );
  getDb().prepare("DELETE FROM holdings WHERE id = ?").run(id);
  deleteOrphanStocks();
  return true;
}
