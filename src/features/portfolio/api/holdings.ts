import { apiDelete, apiPost, apiPut } from "@/lib/api";
import type { Holding, HoldingInput } from "@/types/api";

export function createHolding(input: HoldingInput): Promise<Holding> {
  return apiPost<Holding>("/holdings", input);
}

export function updateHolding(id: number, input: HoldingInput): Promise<Holding> {
  return apiPut<Holding>(`/holdings/${id}`, input);
}

export function deleteHolding(id: number): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`/holdings/${id}`);
}
