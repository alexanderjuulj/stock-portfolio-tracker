import { apiDelete, apiPut } from "@/lib/api";

// Hand-set market prices — concept mode only (the server rejects these
// outside it). A set price pins the ticker until it is cleared again.

export function setQuotePrice(ticker: string, price: number): Promise<{ ok: true }> {
  return apiPut<{ ok: true }>(`/quotes/${encodeURIComponent(ticker)}`, { price });
}

export function clearQuotePrice(ticker: string): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`/quotes/${encodeURIComponent(ticker)}`);
}
