import { apiGet, apiPut } from "@/lib/api";
import type { ApiError, AppSettings } from "@/types/api";

export function getSettings(): Promise<AppSettings> {
  return apiGet<AppSettings>("/settings");
}

export function saveSettings(settings: AppSettings): Promise<AppSettings> {
  return apiPut<AppSettings>("/settings", settings);
}

/** Raw-body upload — the one call that can't go through the JSON helpers. */
export async function importBackup(file: File): Promise<void> {
  const res = await fetch("/api/import", { method: "POST", body: file });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      message = ((await res.json()) as ApiError).error ?? message;
    } catch {
      // Non-JSON error body — keep the status text.
    }
    throw new Error(message);
  }
}
