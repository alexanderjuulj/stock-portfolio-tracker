import { useCallback, useEffect, useState } from "react";
import type { AccountInput, HoldingInput, PortfolioResponse, SaleInput } from "@/types/api";
import * as portfolioApi from "../api";

/**
 * Portfolio state for the dashboard, scoped to `accountId` (null = all
 * accounts): loads on mount and whenever the scope changes, exposes a forced
 * price refresh, and reloads after every mutation. Mutation errors are
 * rethrown so callers can surface them next to the form that caused them.
 */
export function usePortfolio(accountId: number | null) {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (refresh = false) =>
      portfolioApi
        .getPortfolio({ refresh, accountId })
        .then((next) => {
          setData(next);
          setError(null);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        }),
    [accountId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    return load(true);
  }, [load]);

  // Every mutation reloads the scoped portfolio afterwards.
  const mutate = useCallback(
    async (action: () => Promise<unknown>) => {
      await action();
      await load();
    },
    [load],
  );

  const addHolding = useCallback(
    (input: HoldingInput) => mutate(() => portfolioApi.createHolding(input)),
    [mutate],
  );
  const editHolding = useCallback(
    (id: number, input: HoldingInput) => mutate(() => portfolioApi.updateHolding(id, input)),
    [mutate],
  );
  const removeHolding = useCallback(
    (id: number) => mutate(() => portfolioApi.deleteHolding(id)),
    [mutate],
  );
  const removeStock = useCallback(
    (ticker: string) => mutate(() => portfolioApi.deleteStock(ticker)),
    [mutate],
  );
  const sell = useCallback(
    (input: SaleInput) => mutate(() => portfolioApi.createSale(input)),
    [mutate],
  );
  const addAccount = useCallback(
    (input: AccountInput) => mutate(() => portfolioApi.createAccount(input)),
    [mutate],
  );
  const editAccount = useCallback(
    (id: number, input: AccountInput) => mutate(() => portfolioApi.updateAccount(id, input)),
    [mutate],
  );
  const removeAccount = useCallback(
    (id: number) => mutate(() => portfolioApi.deleteAccount(id)),
    [mutate],
  );

  return {
    data,
    loading,
    refreshing,
    error,
    refresh,
    addHolding,
    editHolding,
    removeHolding,
    removeStock,
    sell,
    addAccount,
    editAccount,
    removeAccount,
  };
}
