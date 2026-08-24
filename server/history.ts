// The transaction history: every purchase lot and sale, with each sale's
// FIFO cost basis and realized P/L from the ledger replay, plus realized P/L
// summed per stock × account. Quotes are read from the cache only — tickers
// no longer held shouldn't trigger fetches.

import { listAccounts } from "./accounts";
import { listHoldings, listSales, replayLedger, type SettledSale } from "./ledger";
import { getFxToEur, peekQuotes } from "./quotes";
import { listStocks } from "./stocks";
import type { HistoryEntry, HistoryResponse, RealizedByPosition } from "../src/types/api";

function realizedEurOf(sale: SettledSale, rates: Map<string, number>): number | null {
  const rate = sale.eurPerUnit ?? rates.get(sale.currency);
  return rate === undefined ? null : sale.realizedPl * rate;
}

export async function buildHistory(accountId: number | null): Promise<HistoryResponse> {
  const accounts = listAccounts();
  const stockByTicker = new Map(listStocks().map((s) => [s.ticker, s]));
  const buys = listHoldings();
  const sales = listSales();
  const { openLots, settledSales } = replayLedger(buys, sales);
  const remainingByLot = new Map(openLots.map((l) => [l.id, l.remaining]));

  const quotes = peekQuotes(buys.map((b) => b.ticker));
  const buyCurrency = (ticker: string) =>
    quotes.get(ticker)?.currency ?? stockByTicker.get(ticker)?.currency ?? "USD";
  const { rates, errors } = await getFxToEur(
    settledSales.filter((s) => s.eurPerUnit === null).map((s) => s.currency),
    false,
  );

  const inScope = (ownerAccountId: number) => accountId === null || ownerAccountId === accountId;

  const entries: HistoryEntry[] = [
    ...buys.filter((b) => inScope(b.accountId)).map<HistoryEntry>((b) => ({
      kind: "buy",
      id: b.id,
      date: b.purchasedAt,
      ticker: b.ticker,
      accountId: b.accountId,
      accountName: b.accountName,
      quantity: b.quantity,
      price: b.purchasePrice,
      currency: buyCurrency(b.ticker),
      total: b.quantity * b.purchasePrice,
      remainingQuantity: remainingByLot.get(b.id) ?? 0,
      costBasis: null,
      realizedPl: null,
      realizedPlEur: null,
      unmatchedQuantity: 0,
      cashCredited: null,
      reason: "",
    })),
    ...settledSales.filter((s) => inScope(s.accountId)).map<HistoryEntry>((s) => ({
      kind: "sell",
      id: s.id,
      date: s.soldAt,
      ticker: s.ticker,
      accountId: s.accountId,
      accountName: s.accountName,
      quantity: s.quantity,
      price: s.price,
      currency: s.currency,
      total: s.quantity * s.price,
      remainingQuantity: null,
      costBasis: s.costBasis,
      realizedPl: s.realizedPl,
      realizedPlEur: realizedEurOf(s, rates),
      unmatchedQuantity: s.unmatchedQuantity,
      cashCredited: s.cashCredited,
      reason: s.reason,
    })),
  ];
  // Newest first; undated purchases go last.
  entries.sort(
    (a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id,
  );

  const realizedMap = new Map<string, RealizedByPosition>();
  for (const sale of settledSales) {
    if (!inScope(sale.accountId)) continue;
    const key = `${sale.accountId}:${sale.ticker}`;
    const row = realizedMap.get(key) ?? {
      ticker: sale.ticker,
      accountId: sale.accountId,
      accountName: sale.accountName,
      currency: sale.currency,
      soldQuantity: 0,
      proceeds: 0,
      costBasis: 0,
      realizedPl: 0,
      realizedPlEur: 0,
      salesCount: 0,
    };
    row.soldQuantity += sale.quantity;
    row.proceeds += sale.quantity * sale.price;
    row.costBasis += sale.costBasis;
    row.realizedPl += sale.realizedPl;
    const eur = realizedEurOf(sale, rates);
    row.realizedPlEur = row.realizedPlEur === null || eur === null ? null : row.realizedPlEur + eur;
    row.salesCount += 1;
    realizedMap.set(key, row);
  }
  const realized = [...realizedMap.values()].sort(
    (a, b) => (b.realizedPlEur ?? 0) - (a.realizedPlEur ?? 0) || a.ticker.localeCompare(b.ticker),
  );

  const scopedSales = settledSales.filter((s) => inScope(s.accountId));
  return {
    accountId,
    accounts,
    entries,
    realized,
    totals: {
      realizedEur: scopedSales.reduce((sum, s) => sum + (realizedEurOf(s, rates) ?? 0), 0),
      buys: buys.filter((b) => inScope(b.accountId)).length,
      sales: scopedSales.length,
    },
    errors,
  };
}
