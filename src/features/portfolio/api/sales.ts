import { apiDelete, apiPost, apiPut } from "@/lib/api";
import type { Sale, SaleInput } from "@/types/api";

export function createSale(input: SaleInput): Promise<Sale> {
  return apiPost<Sale>("/sales", input);
}

/** Ticker and account of a sale can't change; the rest can. */
export function updateSale(id: number, input: SaleInput): Promise<Sale> {
  return apiPut<Sale>(`/sales/${id}`, input);
}

/** Removes the sale and takes back the cash it credited. */
export function deleteSale(id: number): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`/sales/${id}`);
}
