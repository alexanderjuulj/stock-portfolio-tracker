import { useCallback, useEffect, useState } from "react";
import type { HistoryResponse, SaleInput } from "@/types/api";
import * as portfolioApi from "../api";

/**
 * Transaction history scoped to `accountId` (null = all accounts); reloads
 * when the scope changes and after a sale is edited or deleted. Mutation
 * errors are rethrown for the caller's form.
 */
export function useHistory(accountId: number | null) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      portfolioApi
        .getHistory(accountId)
        .then((next) => {
          setData(next);
          setError(null);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoading(false)),
    [accountId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const editSale = useCallback(
    async (id: number, input: SaleInput) => {
      await portfolioApi.updateSale(id, input);
      await load();
    },
    [load],
  );

  const removeSale = useCallback(
    async (id: number) => {
      await portfolioApi.deleteSale(id);
      await load();
    },
    [load],
  );

  return { data, loading, error, reload: load, editSale, removeSale };
}
