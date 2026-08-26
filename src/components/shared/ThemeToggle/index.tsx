import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { useTheme } from "@/lib/theme";
import styles from "./ThemeToggle.module.scss";

// Flips between the two palettes from the header. Picking one here pins it;
// "System" remains available on the Settings page.
const ThemeToggle: FC = (): JSX.Element => {
  const { resolved, setTheme } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const label = next === "light" ? "Switch to day desk" : "Switch to night desk";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      {resolved === "dark" ? (
        <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
        </svg>
      ) : (
        <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z" />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
