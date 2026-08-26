import { useState } from "react";
import { applyTheme, getTheme, type Theme } from "@/lib/theme";

export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  const setTheme = (next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  };

  return { theme, setTheme };
}
