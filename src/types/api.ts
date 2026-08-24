// Request/response types shared between the client (src/) and the API
// (server/). The server imports these with a relative path; the client uses
// `@/types/api`.

export type HealthResponse = {
  ok: true;
  sqliteVersion: string;
  schemaVersion: number;
  dbSizeBytes: number;
};

export type ApiError = {
  error: string;
};

// ── Accounts ─────────────────────────────────────────────────────────────────

export type Account = {
  id: number;
  name: string;
  /** Currency the cash balance is held in. */
  currency: string;
  /** Free cash available on the account, in `currency`. */
  cash: number;
};

export type AccountInput = Omit<Account, "id">;

// ── Stocks ───────────────────────────────────────────────────────────────────

/** Per-ticker facts shared by every lot of that stock, whichever account holds it. */
export type Stock = {
  ticker: string;
  sector: string;
  /**
   * Fallback trading currency. When the quote provider reports a currency
   * (Yahoo does), that one wins; this field covers providers that don't.
   */
  currency: string;
  notes: string;
};

export type StockInput = Omit<Stock, "ticker">;

// ── Holdings (lots) ──────────────────────────────────────────────────────────

/** One purchase lot: a quantity of a stock held in one account. */
export type Holding = {
  id: number;
  ticker: string;
  accountId: number;
  quantity: number;
  /** Per-share purchase price, in the stock's trading currency. */
  purchasePrice: number;
  /** Purchase date as YYYY-MM-DD, or null when unknown. */
  purchasedAt: string | null;
};

export type HoldingInput = Omit<Holding, "id"> & {
  /**
   * Stock-level fields saved together with the lot. They are shared by every
   * lot of the ticker, so this updates the existing stock record (or creates
   * it for a new ticker). Omit to leave the stock untouched.
   */
  stock?: StockInput;
};

// ── Sales ────────────────────────────────────────────────────────────────────

/**
 * A sale of shares out of one account. Which purchase lots it consumed is not
 * stored: positions and realized P/L are derived by replaying buys and sales
 * chronologically, oldest lots first (FIFO) — see server/ledger.ts.
 */
export type Sale = {
  id: number;
  ticker: string;
  accountId: number;
  quantity: number;
  /** Per-share sale price, in `currency`. */
  price: number;
  /** Trading currency at the time of the sale. */
  currency: string;
  /** EUR per unit of `currency` when the sale was recorded; null if unknown then. */
  eurPerUnit: number | null;
  /** Added to the account's free cash when recorded (account currency); null if not credited. */
  cashCredited: number | null;
  reason: string;
  /** YYYY-MM-DD */
  soldAt: string;
};

export type SaleInput = {
  ticker: string;
  accountId: number;
  quantity: number;
  price: number;
  soldAt: string;
  reason: string;
  /** Add the proceeds, converted to the account's currency, to its free cash. */
  creditCash: boolean;
};

// ── Portfolio ────────────────────────────────────────────────────────────────

export type PortfolioLot = Holding & {
  accountName: string;
  /** Shares originally bought; `quantity` is what is still held after sales. */
  boughtQuantity: number;
  marketValue: number | null;
  marketValueEur: number | null;
  profit: number | null;
  profitPct: number | null;
};

/**
 * One row per ticker in the selected scope: every lot of the stock summed
 * together, with the per-account breakdown in `lots`. Market-data fields are
 * null when no quote is available.
 */
export type PortfolioPosition = Stock & {
  /** Instrument name reported by the quote provider, when known. */
  name: string | null;
  /** Currency the market data (and purchase prices) are denominated in. */
  currencyEffective: string;
  /** Total shares across the lots in scope. */
  quantity: number;
  /** Quantity-weighted average purchase price. */
  avgPurchasePrice: number;
  marketPrice: number | null;
  profit: number | null;
  profitPct: number | null;
  marketValue: number | null;
  marketValueEur: number | null;
  /** Share of the scoped stocks value, 0–100. */
  portfolioPct: number | null;
  quoteFetchedAt: string | null;
  /** True when the latest fetch failed and a cached price is shown instead. */
  quoteStale: boolean;
  accountCount: number;
  lots: PortfolioLot[];
  /** Realized P/L from sales of this ticker in scope, in `currencyEffective`. */
  realizedPl: number;
  realizedPlEur: number | null;
  salesCount: number;
};

export type AccountSummary = Account & {
  /** Null when there is no EUR rate for the account's currency. */
  cashEur: number | null;
  /** EUR value of the priced lots held in the account. */
  stocksEur: number;
  /** cashEur + stocksEur, or null when cash can't be converted. */
  totalEur: number | null;
  /** Realized P/L from sales out of this account, in EUR. */
  realizedEur: number;
  lotCount: number;
};

export type PortfolioTotals = {
  /** Sum over positions that have both a quote and an EUR rate. */
  stocksEur: number;
  /** Cost basis of those same positions, converted at today's rates. */
  costEur: number;
  /** Unrealized profit of the open positions. */
  profitEur: number;
  profitPct: number | null;
  /** Realized P/L from sales in scope, in EUR (sale-time rates where known). */
  realizedEur: number;
  /** Free cash across the accounts in scope (convertible currencies only). */
  cashEur: number;
  /** stocksEur + cashEur. */
  totalEur: number;
};

export type PortfolioResponse = {
  /** The account scope that was applied, null for "all accounts". */
  accountId: number | null;
  /** Scoped, one row per ticker, largest EUR value first. */
  positions: PortfolioPosition[];
  /** Always every account, regardless of scope. */
  accounts: AccountSummary[];
  /** Always every stock on record (drives ticker/sector suggestions). */
  stocks: Stock[];
  /** Scoped totals. */
  totals: PortfolioTotals;
  /** EUR per unit for every currency in play (stocks and cash). */
  fxRates: Record<string, number>;
  /** Oldest quote timestamp in the response (ISO); null when nothing is quoted. */
  quotesAsOf: string | null;
  /** Human-readable fetch problems (quotes or FX); the rest of the data is usable. */
  errors: string[];
};

// ── History ──────────────────────────────────────────────────────────────────

export type HistoryEntry = {
  kind: "buy" | "sell";
  /** holdings.id for buys, sales.id for sells. */
  id: number;
  /** YYYY-MM-DD; buys may have none. */
  date: string | null;
  ticker: string;
  accountId: number;
  accountName: string;
  quantity: number;
  price: number;
  currency: string;
  /** quantity × price. */
  total: number;
  /** Buys: shares of this lot still held. */
  remainingQuantity: number | null;
  /** Sells: cost of the lots consumed (FIFO) and the resulting P/L, in `currency`. */
  costBasis: number | null;
  realizedPl: number | null;
  realizedPlEur: number | null;
  /** Sells: shares that no earlier purchase could cover (ledger inconsistency). */
  unmatchedQuantity: number;
  /** Sells: cash added to the account when recorded. */
  cashCredited: number | null;
  reason: string;
};

export type RealizedByPosition = {
  ticker: string;
  accountId: number;
  accountName: string;
  currency: string;
  soldQuantity: number;
  proceeds: number;
  costBasis: number;
  realizedPl: number;
  realizedPlEur: number | null;
  salesCount: number;
};

export type HistoryResponse = {
  accountId: number | null;
  accounts: Account[];
  /** Buys and sells in scope, newest first. */
  entries: HistoryEntry[];
  /** Realized P/L per stock × account, largest first. */
  realized: RealizedByPosition[];
  totals: { realizedEur: number; buys: number; sales: number };
  errors: string[];
};

// ── Settings ─────────────────────────────────────────────────────────────────

export type QuoteProvider = "yahoo" | "finnhub";

export type AppSettings = {
  provider: QuoteProvider;
  finnhubApiKey: string;
};
