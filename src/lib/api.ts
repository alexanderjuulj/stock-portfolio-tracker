// Thin fetch wrappers for the local API mounted at /api (see server/).
// Feature `api/` modules build on these; components never call them directly.

import { isConcept } from "@/lib/concept";
import type { ApiError } from "@/types/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // While concept mode is on, every request runs against the server's
  // sandbox copy of the DB instead of the real one (see server/db.ts).
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    ...(isConcept() ? { "x-concept": "1" } : {}),
  };
  const res = await fetch(`/api${path}`, { ...init, headers });
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

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}
