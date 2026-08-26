// Ordered schema migrations. The database's `PRAGMA user_version` records how
// many of these have run; on boot (and after an import) every migration past
// that point is applied in order, each in its own transaction.
//
// Rules:
// - Append only — never edit or reorder an entry that has shipped, since
//   existing database files (including exported backups) rely on the index.
// - Plain SQL strings; one entry may contain multiple statements.
export const MIGRATIONS: string[] = [
  // 001 — portfolio core: holdings, key/value settings, quote + FX caches.
  `
CREATE TABLE holdings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker         TEXT NOT NULL,
  quantity       REAL NOT NULL,
  purchase_price REAL NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD',
  sector         TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Latest fetched market price per ticker (server-side cache; see server/quotes.ts).
CREATE TABLE quotes (
  ticker     TEXT PRIMARY KEY,
  price      REAL NOT NULL,
  currency   TEXT,
  name       TEXT,
  fetched_at TEXT NOT NULL
);

-- 1 unit of currency = eur_per_unit EUR (ECB reference rates via Frankfurter).
CREATE TABLE fx_rates (
  currency     TEXT PRIMARY KEY,
  eur_per_unit REAL NOT NULL,
  fetched_at   TEXT NOT NULL
);
`,

  // 002 — accounts + per-ticker stocks; holdings become per-account lots with
  // a purchase date. Existing lots are moved under a default "Main" account.
  `
CREATE TABLE accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'EUR',
  cash       REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Facts shared by every lot of a ticker, whichever account holds it.
CREATE TABLE stocks (
  ticker     TEXT PRIMARY KEY,
  sector     TEXT NOT NULL DEFAULT '',
  currency   TEXT NOT NULL DEFAULT 'USD',
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO stocks (ticker, sector, currency, notes)
  SELECT ticker, sector, currency, notes FROM holdings
  WHERE id IN (SELECT MIN(id) FROM holdings GROUP BY ticker);

INSERT INTO accounts (name, currency, cash)
  SELECT 'Main', 'EUR', 0 WHERE EXISTS (SELECT 1 FROM holdings);

CREATE TABLE holdings_v2 (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker         TEXT NOT NULL REFERENCES stocks(ticker) ON UPDATE CASCADE ON DELETE CASCADE,
  account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity       REAL NOT NULL,
  purchase_price REAL NOT NULL,
  purchased_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO holdings_v2 (id, ticker, account_id, quantity, purchase_price, created_at, updated_at)
  SELECT id, ticker, (SELECT MIN(id) FROM accounts), quantity, purchase_price, created_at, updated_at
  FROM holdings;

DROP TABLE holdings;
ALTER TABLE holdings_v2 RENAME TO holdings;

CREATE INDEX holdings_ticker_idx ON holdings(ticker);
CREATE INDEX holdings_account_idx ON holdings(account_id);
`,

  // 003 — sales ledger. Lots in `holdings` keep their bought quantity; what is
  // still held is derived by replaying sales against them (server/ledger.ts).
  `
CREATE TABLE sales (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker        TEXT NOT NULL,
  account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity      REAL NOT NULL,
  price         REAL NOT NULL,
  currency      TEXT NOT NULL,
  eur_per_unit  REAL,
  cash_credited REAL,
  reason        TEXT NOT NULL DEFAULT '',
  sold_at       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX sales_ticker_idx ON sales(ticker);
CREATE INDEX sales_account_idx ON sales(account_id);
`,

  // 004 — previous session's close per quote, for the day-change column.
  // Nullable: rows cached before this migration fill it on their next refresh.
  `
ALTER TABLE quotes ADD COLUMN previous_close REAL;
`,
];
