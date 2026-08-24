// CRUD + validation for accounts. Deleting an account cascades to its lots
// (FK ON DELETE CASCADE), so callers clean up orphaned stocks afterwards.

import { getDb } from "./db";
import { deleteOrphanStocks } from "./stocks";
import type { Account, AccountInput } from "../src/types/api";

type AccountRow = { id: number; name: string; currency: string; cash: number };

/** Throws with a user-facing message; route handlers turn that into a 400. */
export function parseAccountInput(body: unknown): AccountInput {
  if (typeof body !== "object" || body === null) throw new Error("Expected a JSON object");
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) throw new Error("Account name is required");

  const currency =
    typeof b.currency === "string" && b.currency.trim() !== ""
      ? b.currency.trim().toUpperCase()
      : "EUR";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a 3-letter code, e.g. EUR");

  const cash = b.cash === undefined || b.cash === null ? 0 : b.cash;
  if (typeof cash !== "number" || !Number.isFinite(cash)) throw new Error("Cash must be a number");

  return { name, currency, cash };
}

export function listAccounts(): Account[] {
  return getDb()
    .prepare("SELECT id, name, currency, cash FROM accounts ORDER BY name COLLATE NOCASE, id")
    .all() as AccountRow[];
}

export function accountExists(id: number): boolean {
  return getDb().prepare("SELECT 1 FROM accounts WHERE id = ?").get(id) !== undefined;
}

export function createAccount(input: AccountInput): Account {
  const result = getDb()
    .prepare("INSERT INTO accounts (name, currency, cash) VALUES (?, ?, ?)")
    .run(input.name, input.currency, input.cash);
  return { id: Number(result.lastInsertRowid), ...input };
}

export function updateAccount(id: number, input: AccountInput): Account | null {
  const result = getDb()
    .prepare(
      `UPDATE accounts SET name = ?, currency = ?, cash = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    )
    .run(input.name, input.currency, input.cash, id);
  return Number(result.changes) === 0 ? null : { id, ...input };
}

export function deleteAccount(id: number): boolean {
  const deleted = Number(getDb().prepare("DELETE FROM accounts WHERE id = ?").run(id).changes) > 0;
  if (deleted) deleteOrphanStocks();
  return deleted;
}
