// The `stocks` table holds what is true of a ticker regardless of which
// account owns it: sector, fallback currency, personal notes. Rows are
// created implicitly with the first lot and removed with the last one.

import { getDb } from "./db";
import type { Stock, StockInput } from "../src/types/api";

const DEFAULT_STOCK: StockInput = { sector: "", currency: "USD", notes: "" };

/** Throws with a user-facing message; route handlers turn that into a 400. */
export function parseStockInput(body: unknown): StockInput {
  if (typeof body !== "object" || body === null) throw new Error("Expected a JSON object");
  const b = body as Record<string, unknown>;

  const currency =
    typeof b.currency === "string" && b.currency.trim() !== ""
      ? b.currency.trim().toUpperCase()
      : "USD";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a 3-letter code, e.g. USD");

  return {
    sector: typeof b.sector === "string" ? b.sector.trim() : "",
    currency,
    notes: typeof b.notes === "string" ? b.notes.trim() : "",
  };
}

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

export function listStocks(): Stock[] {
  return getDb()
    .prepare("SELECT ticker, sector, currency, notes FROM stocks ORDER BY ticker")
    .all() as Stock[];
}

export function getStock(ticker: string): Stock | null {
  const row = getDb()
    .prepare("SELECT ticker, sector, currency, notes FROM stocks WHERE ticker = ?")
    .get(ticker) as Stock | undefined;
  return row ?? null;
}

/**
 * Creates the stock (from `input`, or defaults) if it doesn't exist yet;
 * when it does and `input` is given, updates it — the stock fields are
 * shared by every lot of the ticker, so saving a lot saves them too.
 */
export function upsertStock(ticker: string, input?: StockInput): Stock {
  const existing = getStock(ticker);
  if (existing) return input ? (updateStock(ticker, input) ?? existing) : existing;
  const fields = input ?? DEFAULT_STOCK;
  getDb()
    .prepare("INSERT INTO stocks (ticker, sector, currency, notes) VALUES (?, ?, ?, ?)")
    .run(ticker, fields.sector, fields.currency, fields.notes);
  return { ticker, ...fields };
}

export function updateStock(ticker: string, input: StockInput): Stock | null {
  const result = getDb()
    .prepare(
      `UPDATE stocks SET sector = ?, currency = ?, notes = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE ticker = ?`,
    )
    .run(input.sector, input.currency, input.notes, ticker);
  return Number(result.changes) === 0 ? null : { ticker, ...input };
}

/**
 * Removes the stock, every lot of it (FK cascade) and its sales history —
 * the sales would have no purchases left to be matched against.
 */
export function deleteStock(ticker: string): boolean {
  const db = getDb();
  const deleted = Number(db.prepare("DELETE FROM stocks WHERE ticker = ?").run(ticker).changes) > 0;
  if (deleted) db.prepare("DELETE FROM sales WHERE ticker = ?").run(ticker);
  return deleted;
}

/** Drops stock records that no lot refers to any more. */
export function deleteOrphanStocks(): void {
  getDb().exec("DELETE FROM stocks WHERE ticker NOT IN (SELECT DISTINCT ticker FROM holdings)");
}
