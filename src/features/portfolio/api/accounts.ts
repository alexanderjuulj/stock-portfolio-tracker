import { apiDelete, apiPost, apiPut } from "@/lib/api";
import type { Account, AccountInput } from "@/types/api";

export function createAccount(input: AccountInput): Promise<Account> {
  return apiPost<Account>("/accounts", input);
}

export function updateAccount(id: number, input: AccountInput): Promise<Account> {
  return apiPut<Account>(`/accounts/${id}`, input);
}

/** Removes the account and every lot held in it. */
export function deleteAccount(id: number): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`/accounts/${id}`);
}
