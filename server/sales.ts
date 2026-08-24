// Sales CRUD + validation. Recording a sale checks the ledger has the shares,
// snapshots the trading currency and EUR rate, and (optionally) credits the
// proceeds — converted to the account's currency — to its free cash. Deleting
// or editing a sale reverts / re-applies that credit.

import { getDb } from "./db";
import { availableQuantity, listHoldings, listSales, QTY_EPSILON } from "./ledger";
import { getFxToEur, getQuotes } from "./quotes";
import { getStock, normalizeTicker } from "./stocks";
import type { Account, Sale, SaleInput } from "../src/types/api";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function formatQuantity(value: number): string {
  return Number(value.toFixed(4)).toString();
}

/** Throws with a user-facing message; route handlers turn that into a 400. */
export function parseSaleInput(body: unknown): SaleInput {
  if (typeof body !== "object" || body === null) throw new Error("Expected a JSON object");
  const b = body as Record<string, unknown>;

  const ticker = typeof b.ticker === "string" ? normalizeTicker(b.ticker) : "";
  if (!ticker) throw new Error("Ticker is required");

  const accountId = typeof b.accountId === "number" ? b.accountId : NaN;
  if (!Number.isInteger(accountId)) throw new Error("Account is required");

  const quantity = typeof b.quantity === "number" ? b.quantity : NaN;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Amount must be a number greater than 0");
  }

  const price = typeof b.price === "number" ? b.price : NaN;
  if (!Number.isFinite(price) || price < 0) throw new Error("Sale price must be a non-negative number");

  const soldAt = typeof b.soldAt === "string" ? b.soldAt.trim() : "";
  if (!isValidDate(soldAt)) throw new Error("Sale date must be a valid YYYY-MM-DD date");

  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!reason) throw new Error("Give a reason for selling");

  return { ticker, accountId, quantity, price, soldAt, reason, creditCash: b.creditCash !== false };
}

function getAccount(id: number): Account | null {
  const row = getDb().prepare("SELECT id, name, currency, cash FROM accounts WHERE id = ?").get(id) as
    | Account
    | undefined;
  return row ?? null;
}

/** Proceeds expressed in the account's currency, via EUR when they differ. */
function cashCreditFor(
  proceeds: number,
  currency: string,
  account: Account,
  rates: Map<string, number>,
): number {
  if (currency === account.currency) return proceeds;
  const from = rates.get(currency);
  const to = rates.get(account.currency);
  if (from === undefined || to === undefined) {
    throw new Error(
      `Can't convert ${currency} proceeds to ${account.currency} — no exchange rate. Untick "add to free cash" or try again later`,
    );
  }
  return (proceeds * from) / to;
}

function assertAvailable(input: SaleInput, excludeSaleId: number | null, accountName: string): void {
  const sales = listSales().filter((s) => s.id !== excludeSaleId);
  const available = availableQuantity(listHoldings(), sales, input.accountId, input.ticker, input.soldAt);
  if (input.quantity > available + QTY_EPSILON) {
    throw new Error(
      available > QTY_EPSILON
        ? `Only ${formatQuantity(available)} ${input.ticker} shares are held in ${accountName} on ${input.soldAt}`
        : `No ${input.ticker} shares are held in ${accountName} on ${input.soldAt}`,
    );
  }
}

function inTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export async function createSale(input: SaleInput): Promise<Sale> {
  const account = getAccount(input.accountId);
  if (!account) throw new Error("Account not found");
  const stock = getStock(input.ticker);
  if (!stock) throw new Error(`You don't hold ${input.ticker}`);
  assertAvailable(input, null, account.name);

  const { quotes } = await getQuotes([input.ticker], false);
  const currency = quotes.get(input.ticker)?.currency ?? stock.currency;
  const { rates } = await getFxToEur([currency, account.currency], false);
  const eurPerUnit = rates.get(currency) ?? null;
  const cashCredited = input.creditCash
    ? cashCreditFor(input.quantity * input.price, currency, account, rates)
    : null;

  return inTransaction(() => {
    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO sales (ticker, account_id, quantity, price, currency, eur_per_unit, cash_credited, reason, sold_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.ticker,
        input.accountId,
        input.quantity,
        input.price,
        currency,
        eurPerUnit,
        cashCredited,
        input.reason,
        input.soldAt,
      );
    if (cashCredited !== null) {
      db.prepare("UPDATE accounts SET cash = cash + ? WHERE id = ?").run(cashCredited, input.accountId);
    }
    return {
      id: Number(result.lastInsertRowid),
      ticker: input.ticker,
      accountId: input.accountId,
      quantity: input.quantity,
      price: input.price,
      currency,
      eurPerUnit,
      cashCredited,
      reason: input.reason,
      soldAt: input.soldAt,
    };
  });
}

/**
 * Edits amount, price, date, reason and the cash credit of a sale. Ticker and
 * account stay what they were (delete and re-record to move a sale).
 */
export async function updateSale(id: number, input: SaleInput): Promise<Sale | null> {
  const existing = listSales().find((s) => s.id === id);
  if (!existing) return null;
  const account = getAccount(existing.accountId);
  if (!account) throw new Error("Account not found");

  const next: SaleInput = { ...input, ticker: existing.ticker, accountId: existing.accountId };
  assertAvailable(next, id, account.name);

  const { rates } = await getFxToEur([existing.currency, account.currency], false);
  const cashCredited = next.creditCash
    ? cashCreditFor(next.quantity * next.price, existing.currency, account, rates)
    : null;

  return inTransaction(() => {
    const db = getDb();
    db.prepare(
      `UPDATE sales SET quantity = ?, price = ?, cash_credited = ?, reason = ?, sold_at = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).run(next.quantity, next.price, cashCredited, next.reason, next.soldAt, id);
    const delta = (cashCredited ?? 0) - (existing.cashCredited ?? 0);
    if (delta !== 0) {
      db.prepare("UPDATE accounts SET cash = cash + ? WHERE id = ?").run(delta, existing.accountId);
    }
    return {
      id,
      ticker: existing.ticker,
      accountId: existing.accountId,
      quantity: next.quantity,
      price: next.price,
      currency: existing.currency,
      eurPerUnit: existing.eurPerUnit,
      cashCredited,
      reason: next.reason,
      soldAt: next.soldAt,
    };
  });
}

/** Removes the sale and takes back the cash it credited. */
export function deleteSale(id: number): boolean {
  const existing = listSales().find((s) => s.id === id);
  if (!existing) return false;
  inTransaction(() => {
    const db = getDb();
    db.prepare("DELETE FROM sales WHERE id = ?").run(id);
    if (existing.cashCredited !== null) {
      db.prepare("UPDATE accounts SET cash = cash - ? WHERE id = ?").run(existing.cashCredited, existing.accountId);
    }
  });
  return true;
}
