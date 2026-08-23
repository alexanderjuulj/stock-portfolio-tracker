// Thin fetch wrappers for the local API mounted at /api (see server/).
// Feature `api/` modules build on these; components never call them directly.

import type { ApiError } from "@/types/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      message = ((await res.json()) as ApiError).error ?? message;
    } catch {
      // Non-JSON error body — keep the status text.
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
