// Joins the ledger (open lots + settled sales), stocks, accounts, quotes and
// EUR rates into the dashboard's model: one position per ticker (open lots
// summed, per-account breakdown attached), account summaries with cash and
// realized P/L, and scoped totals. All derived numbers are computed here so
// the client only formats.

import { listAccounts } from "./accounts";
import { listHoldings, listSales, replayLedger, type SettledSale } from "./ledger";
import { getFxToEur, getQuotes } from "./quotes";
import { listStocks } from "./stocks";
import type {
  AccountSummary,
  PortfolioLot,
  PortfolioPosition,
  PortfolioResponse,
  PortfolioTotals,
  SectorAllocation,
} from "../src/types/api";

type PortfolioOptions = {
  /** Bypass the quote/FX caches. */
  force: boolean;
  /** Restrict positions and totals to one account; null = all accounts. */
  accountId: number | null;
};

/** EUR value of a sale's realized P/L: sale-time rate when known, else today's. */
function realizedEurOf(sale: SettledSale, rates: Map<string, number>): number | null {
  const rate = sale.eurPerUnit ?? rates.get(sale.currency);
  return rate === undefined ? null : sale.realizedPl * rate;
}

export async function buildPortfolio({ force, accountId }: PortfolioOptions): Promise<PortfolioResponse> {
  const accounts = listAccounts();
  const stocks = listStocks();
  const stockByTicker = new Map(stocks.map((s) => [s.ticker, s]));
  const { openLots, settledSales } = replayLedger(listHoldings(), listSales());

  const { quotes, errors: quoteErrors } = await getQuotes(
    openLots.map((l) => l.ticker),
    force,
  );

  // Each open ticker's effective currency: the quote's if reported, else the stock's.
  const tickerCurrency = new Map<string, string>();
  for (const lot of openLots) {
    if (!tickerCurrency.has(lot.ticker)) {
      tickerCurrency.set(
        lot.ticker,
        quotes.get(lot.ticker)?.currency ?? stockByTicker.get(lot.ticker)?.currency ?? "USD",
      );
    }
  }
  const { rates, errors: fxErrors } = await getFxToEur(
    [
      ...tickerCurrency.values(),
      ...accounts.map((a) => a.currency),
      ...settledSales.filter((s) => s.eurPerUnit === null).map((s) => s.currency),
    ],
    force,
  );

  // Per-lot values, unscoped — the account summaries need all of them.
  const computedLots: PortfolioLot[] = openLots.map((lot) => {
    const quote = quotes.get(lot.ticker);
    const rate = rates.get(tickerCurrency.get(lot.ticker) ?? "USD");
    const marketPrice = quote?.price ?? null;
    const marketValue = marketPrice === null ? null : marketPrice * lot.remaining;
    const profit = marketPrice === null ? null : (marketPrice - lot.purchasePrice) * lot.remaining;
    const profitPct =
      marketPrice === null || lot.purchasePrice <= 0
        ? null
        : (marketPrice / lot.purchasePrice - 1) * 100;
    const marketValueEur = marketValue === null || rate === undefined ? null : marketValue * rate;
    return {
      id: lot.id,
      ticker: lot.ticker,
      accountId: lot.accountId,
      accountName: lot.accountName,
      quantity: lot.remaining,
      boughtQuantity: lot.quantity,
      purchasePrice: lot.purchasePrice,
      purchasedAt: lot.purchasedAt,
      marketValue,
      marketValueEur,
      profit,
      profitPct,
    };
  });

  const accountSummaries: AccountSummary[] = accounts.map((account) => {
    const own = computedLots.filter((l) => l.accountId === account.id);
    const stocksEur = own.reduce((sum, l) => sum + (l.marketValueEur ?? 0), 0);
    const cashRate = rates.get(account.currency);
    const cashEur = cashRate === undefined ? null : account.cash * cashRate;
    const realizedEur = settledSales
      .filter((s) => s.accountId === account.id)
      .reduce((sum, s) => sum + (realizedEurOf(s, rates) ?? 0), 0);
    return {
      ...account,
      cashEur,
      cashPct: null,
      stocksEur,
      totalEur: cashEur === null ? null : cashEur + stocksEur,
      realizedEur,
      lotCount: own.length,
    };
  });
  const portfolioEur = accountSummaries.reduce((sum, a) => sum + (a.totalEur ?? 0), 0);
  if (portfolioEur > 0) {
    for (const account of accountSummaries) {
      if (account.cashEur !== null) account.cashPct = (account.cashEur / portfolioEur) * 100;
    }
  }

  const inScope = (ownerAccountId: number) => accountId === null || ownerAccountId === accountId;
  const scopedLots = computedLots.filter((l) => inScope(l.accountId));
  const scopedSales = settledSales.filter((s) => inScope(s.accountId));
  const scopedAccounts = accountSummaries.filter((a) => inScope(a.id));

  const lotsByTicker = new Map<string, PortfolioLot[]>();
  for (const lot of scopedLots) {
    const group = lotsByTicker.get(lot.ticker);
    if (group) group.push(lot);
    else lotsByTicker.set(lot.ticker, [lot]);
  }

  let stocksEur = 0;
  let costEur = 0;
  const positions: PortfolioPosition[] = [];

  for (const [ticker, tickerLots] of lotsByTicker) {
    const stock = stockByTicker.get(ticker) ?? { ticker, sector: "", currency: "USD", notes: "" };
    const quote = quotes.get(ticker);
    const currencyEffective = tickerCurrency.get(ticker) ?? stock.currency;
    const rate = rates.get(currencyEffective);

    const quantity = tickerLots.reduce((sum, l) => sum + l.quantity, 0);
    const cost = tickerLots.reduce((sum, l) => sum + l.purchasePrice * l.quantity, 0);
    const marketPrice = quote?.price ?? null;
    const previousClose = quote?.previousClose ?? null;
    const dayChangePct =
      marketPrice === null || previousClose === null || previousClose <= 0
        ? null
        : (marketPrice / previousClose - 1) * 100;
    const marketValue = marketPrice === null ? null : marketPrice * quantity;
    const profit = marketValue === null ? null : marketValue - cost;
    const profitPct = marketValue === null || cost <= 0 ? null : (marketValue / cost - 1) * 100;
    const marketValueEur = marketValue === null || rate === undefined ? null : marketValue * rate;

    if (marketValueEur !== null && rate !== undefined) {
      stocksEur += marketValueEur;
      costEur += cost * rate;
    }

    const tickerSales = scopedSales.filter((s) => s.ticker === ticker);
    const realizedPl = tickerSales.reduce((sum, s) => sum + s.realizedPl, 0);
    let realizedPlEur: number | null = 0;
    for (const sale of tickerSales) {
      const eur = realizedEurOf(sale, rates);
      if (eur === null) {
        realizedPlEur = null;
        break;
      }
      realizedPlEur += eur;
    }

    positions.push({
      ...stock,
      name: quote?.name ?? null,
      currencyEffective,
      quantity,
      avgPurchasePrice: quantity > 0 ? cost / quantity : 0,
      marketPrice,
      dayChangePct,
      profit,
      profitPct,
      marketValue,
      marketValueEur,
      portfolioPct: null,
      quoteFetchedAt: quote?.fetchedAt ?? null,
      quoteStale: quote?.stale ?? false,
      accountCount: new Set(tickerLots.map((l) => l.accountId)).size,
      lots: tickerLots,
      realizedPl,
      realizedPlEur,
      salesCount: tickerSales.length,
    });
  }

  if (stocksEur > 0) {
    for (const position of positions) {
      if (position.marketValueEur !== null) {
        position.portfolioPct = (position.marketValueEur / stocksEur) * 100;
      }
    }
  }

  // Largest EUR position first; unpriced rows last, alphabetically.
  positions.sort(
    (a, b) =>
      (b.marketValueEur ?? -1) - (a.marketValueEur ?? -1) || a.ticker.localeCompare(b.ticker),
  );

  // Sector allocation of the priced positions, largest first.
  const bySector = new Map<string, SectorAllocation>();
  for (const position of positions) {
    if (position.marketValueEur === null) continue;
    const sector = position.sector || "Unassigned";
    const entry = bySector.get(sector) ?? { sector, valueEur: 0, pct: 0, tickers: [] };
    entry.valueEur += position.marketValueEur;
    entry.tickers.push(position.ticker);
    bySector.set(sector, entry);
  }
  const sectors = [...bySector.values()]
    .map((s) => ({ ...s, pct: stocksEur > 0 ? (s.valueEur / stocksEur) * 100 : 0 }))
    .sort((a, b) => b.valueEur - a.valueEur || a.sector.localeCompare(b.sector));

  const cashEur = scopedAccounts.reduce((sum, a) => sum + (a.cashEur ?? 0), 0);
  const realizedEur = scopedSales.reduce((sum, s) => sum + (realizedEurOf(s, rates) ?? 0), 0);
  const profitEur = stocksEur - costEur;
  const totalEur = stocksEur + cashEur;
  const totals: PortfolioTotals = {
    stocksEur,
    costEur,
    profitEur,
    profitPct: costEur > 0 ? (profitEur / costEur) * 100 : null,
    realizedEur,
    cashEur,
    totalEur,
    cashPct: totalEur > 0 ? (cashEur / totalEur) * 100 : null,
  };

  let quotesAsOf: string | null = null;
  for (const position of positions) {
    if (
      position.quoteFetchedAt &&
      (quotesAsOf === null || position.quoteFetchedAt < quotesAsOf)
    ) {
      quotesAsOf = position.quoteFetchedAt;
    }
  }

  const errors = [...quoteErrors, ...fxErrors];
  const broken = settledSales.filter((s) => s.unmatchedQuantity > 0);
  for (const sale of broken) {
    errors.push(
      `${sale.ticker}: a sale of ${sale.quantity} from ${sale.accountName} on ${sale.soldAt} exceeds the shares bought before it`,
    );
  }

  return {
    accountId,
    positions,
    accounts: accountSummaries,
    stocks,
    totals,
    sectors,
    fxRates: Object.fromEntries(rates),
    quotesAsOf,
    errors,
  };
}
