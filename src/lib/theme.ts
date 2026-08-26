// Appearance is a per-browser preference, not portfolio data, so it lives in
// localStorage rather than the DB. "system" removes the attribute and lets
// `prefers-color-scheme` pick the palette (see base/_colors.scss). The inline
// script in index.html applies the saved value before first paint.
export type Theme = "system" | "light" | "dark";

export const THEMES: ReadonlyArray<{ value: Theme; label: string; note: string }> = [
  { value: "system", label: "System", note: "Follows the operating system's light or dark setting." },
  { value: "dark", label: "Night desk", note: "Black ground, luminous figures. The default look." },
  { value: "light", label: "Day desk", note: "Cool paper and deep ink for bright rooms." },
];

const STORAGE_KEY = "rahamasin.theme";

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode or storage disabled: the choice still applies for this page.
  }
}
