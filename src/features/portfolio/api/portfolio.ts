import { apiGet } from "@/lib/api";
import type { PortfolioResponse } from "@/types/api";

type PortfolioQuery = {
  /** Bypass the server's quote/FX caches and refetch every price. */
  refresh?: boolean;
  /** Restrict positions and totals to one account; null/undefined = all. */
  accountId?: number | null;
};

export function getPortfolio({ refresh = false, accountId = null }: PortfolioQuery = {}): Promise<PortfolioResponse> {
  const params = new URLSearchParams();
  if (refresh) params.set("refresh", "1");
  if (accountId !== null) params.set("account", String(accountId));
  const query = params.toString();
  return apiGet<PortfolioResponse>(query ? `/portfolio?${query}` : "/portfolio");
}
