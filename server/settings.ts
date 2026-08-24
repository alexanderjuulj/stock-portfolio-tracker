// Key/value app settings stored in the `settings` table.
//
// Keys in use:
// - "quote_provider"   — "yahoo" | "finnhub" (see server/quotes.ts)
// - "finnhub_api_key"  — only needed when the provider is finnhub

import { getDb } from "./db";

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}
