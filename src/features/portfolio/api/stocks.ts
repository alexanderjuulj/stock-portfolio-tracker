import { apiDelete, apiPut } from "@/lib/api";
import type { Stock, StockInput } from "@/types/api";

export function updateStock(ticker: string, input: StockInput): Promise<Stock> {
  return apiPut<Stock>(`/stocks/${encodeURIComponent(ticker)}`, input);
}

/** Removes the stock and every lot of it, in all accounts. */
export function deleteStock(ticker: string): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`/stocks/${encodeURIComponent(ticker)}`);
}
