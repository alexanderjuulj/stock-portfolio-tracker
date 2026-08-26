import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import styles from "./PrivacyToggle.module.scss";

// Hides money amounts and share counts everywhere (they render as bullets)
// for screen sharing; percentages and tickers stay readable.
const PrivacyToggle: FC = (): JSX.Element => {
  const { hidden, setHidden } = usePrivacy();
  const label = hidden ? "Show figures" : "Hide figures";

  return (
    <button
      type="button"
      className={cn(styles.toggle, hidden && styles.toggleOn)}
      onClick={() => setHidden(!hidden)}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
    >
      {hidden ? (
        <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 2l12 12" />
          <path d="M6.6 3.4A7 7 0 0 1 8 3.25c3.5 0 6 3 6.75 4.75a8.6 8.6 0 0 1-2.1 2.7M4.2 5.2A8.9 8.9 0 0 0 1.25 8C2 9.75 4.5 12.75 8 12.75c1 0 1.9-.25 2.7-.65" />
          <path d="M6.6 6.6a2 2 0 0 0 2.8 2.8" />
        </svg>
      ) : (
        <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1.25 8C2 6.25 4.5 3.25 8 3.25S14 6.25 14.75 8C14 9.75 11.5 12.75 8 12.75S2 9.75 1.25 8z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      )}
    </button>
  );
};

export default PrivacyToggle;
