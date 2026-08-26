import { useSyncExternalStore } from "react";

// Appearance is a per-browser preference, not portfolio data, so it lives in
// localStorage rather than the DB. "system" removes the attribute and lets
// `prefers-color-scheme` pick the palette (see base/_colors.scss). The inline
// script in index.html applies the saved value before first paint. A tiny
// external store keeps the header toggle and the Settings page in sync.
export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEMES: ReadonlyArray<{ value: Theme; label: string; note: string }> = [
  { value: "system", label: "System", note: "Follows the operating system's light or dark setting." },
  { value: "dark", label: "Night desk", note: "Black ground, luminous figures. The default look." },
  { value: "light", label: "Day desk", note: "Cool paper and deep ink for bright rooms." },
];

const STORAGE_KEY = "rahamasin.theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";
const listeners = new Set<() => void>();

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

let current: Theme = readStored();

export function getTheme(): Theme {
  return current;
}

/** The palette actually on screen, with "system" resolved via the OS preference. */
export function resolveTheme(theme: Theme = current): ResolvedTheme {
  if (theme !== "system") return theme;
  return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  current = theme;
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode or storage disabled: the choice still applies for this page.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Re-render when the OS preference flips while on "system".
  const mq = window.matchMedia(LIGHT_QUERY);
  mq.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", listener);
  };
}

export function useTheme(): {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (next: Theme) => void;
} {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "system" as Theme);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(),
    () => "dark" as ResolvedTheme,
  );
  return { theme, resolved, setTheme: applyTheme };
}
