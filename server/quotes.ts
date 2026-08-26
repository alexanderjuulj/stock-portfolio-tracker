// Market quotes + EUR exchange rates, fetched server-side and cached in
// SQLite (`quotes` / `fx_rates` tables) so restarts and repeated page loads
// don't hammer the providers.
//
// Providers (picked on the Settings page via the `quote_provider` setting):
// - yahoo (default): unofficial chart API — no key, covers most exchanges,
//   reports the trading currency and instrument name.
// - finnhub: official free tier — needs `finnhub_api_key`, US listings only,
//   reports the price alone (the holding's own currency is used instead).

import { getDb } from "./db";
import { getSetting } from "./settings";
import type { QuoteProvider } from "../src/types/api";

const QUOTE_TTL_MS = 15 * 60 * 1000;
const FX_TTL_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_CONCURRENCY = 5;

export type Quote = {
  ticker: string;
  price: number;
  /** Previous session's close, when the provider reports it. */
  previousClose: number | null;
  currency: string | null;
  name: string | null;
  fetchedAt: string;
  /** True when the latest refresh failed and this is an expired cache entry. */
  stale: boolean;
};

export function getQuoteProvider(): QuoteProvider {
  return getSetting("quote_provider") === "finnhub" ? "finnhub" : "yahoo";
}

// ── Provider fetchers ────────────────────────────────────────────────────────

type FetchedQuote = {
  price: number;
  previousClose: number | null;
  currency: string | null;
  name: string | null;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

async function fetchYahoo(ticker: string): Promise<FetchedQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (rahamasin, local portfolio tracker)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status === 404) throw new Error("unknown symbol");
  if (res.status === 429) throw new Error("Yahoo rate limit reached — try again in a minute");
  if (!res.ok) throw new Error(`Yahoo responded ${res.status}`);
  const json = (await res.json()) as YahooChartResponse;
  const error = json.chart?.error;
  if (error) throw new Error(error.description || error.code || "Yahoo returned an error");
  const meta = json.chart?.result?.[0]?.meta;
  if (typeof meta?.regularMarketPrice !== "number") throw new Error("no price in the Yahoo response");
  let price = meta.regularMarketPrice;
  let previousClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
  let currency = meta.currency ?? null;
  if (currency === "GBp") {
    price /= 100; // London quotes arrive in pence
    if (previousClose !== null) previousClose /= 100;
    currency = "GBP";
  }
  return { price, previousClose, currency, name: meta.shortName ?? meta.longName ?? null };
}

async function fetchFinnhub(ticker: string): Promise<FetchedQuote> {
  const key = getSetting("finnhub_api_key");
  if (!key) throw new Error("Finnhub API key missing — add it on the Settings page");
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(key)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 401 || res.status === 403) throw new Error("Finnhub rejected the API key");
  if (res.status === 429) throw new Error("Finnhub rate limit reached — try again in a minute");
  if (!res.ok) throw new Error(`Finnhub responded ${res.status}`);
  const json = (await res.json()) as { c?: number; pc?: number };
  if (!json.c) throw new Error("unknown symbol"); // Finnhub reports price 0 for tickers it doesn't know
  return { price: json.c, previousClose: json.pc || null, currency: null, name: null };
}

// ── Quote cache ──────────────────────────────────────────────────────────────

type QuoteRow = {
  ticker: string;
  price: number;
  previous_close: number | null;
  currency: string | null;
  name: string | null;
  fetched_at: string;
};

function isFresh(fetchedAt: string, ttlMs: number): boolean {
  const age = Date.now() - Date.parse(fetchedAt);
  return Number.isFinite(age) && age < ttlMs;
}

function rowToQuote(row: QuoteRow, stale: boolean): Quote {
  return {
    ticker: row.ticker,
    price: row.price,
    previousClose: row.previous_close,
    currency: row.currency,
    name: row.name,
    fetchedAt: row.fetched_at,
    stale,
  };
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        await fn(items[next++]);
      }
    }),
  );
}

/**
 * Latest price per ticker. Fresh cache entries are returned as-is; the rest
 * are fetched from the configured provider (`force` refetches everything).
 * A failed fetch falls back to the cached price, marked stale.
 */
export async function getQuotes(
  tickers: string[],
  force: boolean,
): Promise<{ quotes: Map<string, Quote>; errors: string[] }> {
  const db = getDb();
  const unique = [...new Set(tickers)];
  const quotes = new Map<string, Quote>();
  const errors: string[] = [];

  const select = db.prepare(
    "SELECT ticker, price, previous_close, currency, name, fetched_at FROM quotes WHERE ticker = ?",
  );
  const cached = new Map<string, QuoteRow>();
  for (const ticker of unique) {
    const row = select.get(ticker) as QuoteRow | undefined;
    if (row) cached.set(ticker, row);
  }

  const toFetch = unique.filter((ticker) => {
    const row = cached.get(ticker);
    return force || !row || !isFresh(row.fetched_at, QUOTE_TTL_MS);
  });

  const provider = getQuoteProvider();
  const upsert = db.prepare(
    `INSERT INTO quotes (ticker, price, previous_close, currency, name, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       price = excluded.price, previous_close = excluded.previous_close,
       currency = excluded.currency, name = excluded.name, fetched_at = excluded.fetched_at`,
  );

  await mapLimit(toFetch, FETCH_CONCURRENCY, async (ticker) => {
    try {
      const fetched = provider === "finnhub" ? await fetchFinnhub(ticker) : await fetchYahoo(ticker);
      const fetchedAt = new Date().toISOString();
      upsert.run(
        ticker,
        fetched.price,
        fetched.previousClose,
        fetched.currency,
        fetched.name,
        fetchedAt,
      );
      quotes.set(ticker, { ticker, ...fetched, fetchedAt, stale: false });
    } catch (err) {
      errors.push(`${ticker}: ${err instanceof Error ? err.message : String(err)}`);
      const row = cached.get(ticker);
      if (row) quotes.set(ticker, rowToQuote(row, true));
    }
  });

  // Everything left is a fresh cache hit.
  for (const ticker of unique) {
    if (!quotes.has(ticker)) {
      const row = cached.get(ticker);
      if (row) quotes.set(ticker, rowToQuote(row, false));
    }
  }

  return { quotes, errors };
}

/** Cache-only lookup — never fetches. For history views of tickers no longer held. */
export function peekQuotes(tickers: string[]): Map<string, Quote> {
  const select = getDb().prepare(
    "SELECT ticker, price, previous_close, currency, name, fetched_at FROM quotes WHERE ticker = ?",
  );
  const quotes = new Map<string, Quote>();
  for (const ticker of new Set(tickers)) {
    const row = select.get(ticker) as QuoteRow | undefined;
    if (row) quotes.set(ticker, rowToQuote(row, !isFresh(row.fetched_at, QUOTE_TTL_MS)));
  }
  return quotes;
}

// ── EUR exchange rates ───────────────────────────────────────────────────────

type FxRow = { currency: string; eur_per_unit: number; fetched_at: string };

/**
 * EUR value of 1 unit of each requested currency, from the ECB reference
 * rates (Frankfurter, keyless). One request refreshes all currencies at once;
 * on failure cached rates keep being used regardless of age.
 */
export async function getFxToEur(
  currencies: string[],
  force: boolean,
): Promise<{ rates: Map<string, number>; errors: string[] }> {
  const db = getDb();
  const rates = new Map<string, number>([["EUR", 1]]);
  const errors: string[] = [];
  const needed = [...new Set(currencies)].filter((c) => c !== "EUR");
  if (needed.length === 0) return { rates, errors };

  const select = db.prepare(
    "SELECT currency, eur_per_unit, fetched_at FROM fx_rates WHERE currency = ?",
  );
  const cached = new Map<string, FxRow>();
  for (const currency of needed) {
    const row = select.get(currency) as FxRow | undefined;
    if (row) cached.set(currency, row);
  }

  const mustFetch =
    force ||
    needed.some((currency) => {
      const row = cached.get(currency);
      return !row || !isFresh(row.fetched_at, FX_TTL_MS);
    });

  if (mustFetch) {
    try {
      const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR", {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Frankfurter responded ${res.status}`);
      const json = (await res.json()) as { rates?: Record<string, number> };
      const fetchedAt = new Date().toISOString();
      const upsert = db.prepare(
        `INSERT INTO fx_rates (currency, eur_per_unit, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(currency) DO UPDATE SET
           eur_per_unit = excluded.eur_per_unit, fetched_at = excluded.fetched_at`,
      );
      for (const [currency, perEur] of Object.entries(json.rates ?? {})) {
        if (perEur > 0) {
          upsert.run(currency, 1 / perEur, fetchedAt);
          cached.set(currency, { currency, eur_per_unit: 1 / perEur, fetched_at: fetchedAt });
        }
      }
    } catch (err) {
      errors.push(`EUR rates: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const currency of needed) {
    const row = cached.get(currency);
    if (row) rates.set(currency, row.eur_per_unit);
    else errors.push(`${currency}: no EUR exchange rate available`);
  }

  return { rates, errors };
}
