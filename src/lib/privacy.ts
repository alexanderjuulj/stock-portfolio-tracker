import { useSyncExternalStore } from "react";

// "Hide figures" mode for screen sharing or a glance over the shoulder:
// money amounts and share counts render as bullets (see formatPrice &
// friends in utils.ts); percentages, tickers and sectors stay readable.
// A per-browser preference like the theme, so it lives in localStorage.
const STORAGE_KEY = "rahamasin.privacy";
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let hidden = readStored();

export function isPrivate(): boolean {
  return hidden;
}

export function setPrivate(next: boolean): void {
  hidden = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the choice still applies for this page.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrivacy(): { hidden: boolean; setHidden: (next: boolean) => void } {
  const value = useSyncExternalStore(subscribe, isPrivate, () => false);
  return { hidden: value, setHidden: setPrivate };
}
