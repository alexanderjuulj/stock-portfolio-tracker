import { useSyncExternalStore } from "react";

// "Concept" mode: a what-if sandbox. While on, every API request carries the
// x-concept header and runs against a throwaway copy of the database (see
// server/db.ts), so prices, lots, cash — everything — can be changed freely
// and none of it touches the real portfolio. Leaving discards the sandbox.
// The flag is per-browser like the theme; the sandbox file lives with the
// server, so a reload or dev-server restart resumes the same experiment.
const STORAGE_KEY = "rahamasin.concept";
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let active = readStored();

export function isConcept(): boolean {
  return active;
}

function apply(next: boolean): void {
  active = next;
  // The gray "concept desk" palette keys off this attribute (base/_colors.scss).
  if (next) document.documentElement.dataset.concept = "1";
  else delete document.documentElement.dataset.concept;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the choice still applies for this page.
  }
  listeners.forEach((l) => l());
}

/**
 * Enter (fork a fresh sandbox) or leave (discard it) concept mode. A plain
 * fetch, not the lib/api wrappers, so this file has no import cycle with
 * them; the local flag only flips once the server has switched.
 */
export async function setConcept(next: boolean): Promise<void> {
  if (next === active) return;
  const res = await fetch("/api/concept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active: next }),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // Non-JSON error body — keep the status text.
    }
    throw new Error(message);
  }
  apply(next);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useConcept(): { active: boolean; setActive: (next: boolean) => Promise<void> } {
  const value = useSyncExternalStore(subscribe, isConcept, () => false);
  return { active: value, setActive: setConcept };
}
