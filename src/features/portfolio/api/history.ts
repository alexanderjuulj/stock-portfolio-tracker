import { apiGet } from "@/lib/api";
import type { HistoryResponse } from "@/types/api";

/** Buys and sells with realized P/L; `accountId` scopes to one account. */
export function getHistory(accountId: number | null = null): Promise<HistoryResponse> {
  return apiGet<HistoryResponse>(accountId === null ? "/history" : `/history?account=${accountId}`);
}
