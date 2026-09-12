import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { useConcept } from "@/lib/concept";
import { cn } from "@/lib/utils";
import ConfirmDialog from "../ConfirmDialog";
import styles from "./ConceptToggle.module.scss";

// Enters/leaves concept mode: a sandbox copy of the portfolio where prices,
// lots and cash can be changed freely without touching the real data.
// Leaving throws the sandbox away, so that direction asks first.
const ConceptToggle: FC = (): JSX.Element => {
  const { active, setActive } = useConcept();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = active ? "Leave concept mode" : "Enter concept mode";

  const switchTo = (next: boolean) => {
    setBusy(true);
    setActive(next)
      .catch((err: unknown) => console.error("Concept mode switch failed:", err))
      .finally(() => {
        setBusy(false);
        setConfirming(false);
      });
  };

  return (
    <>
      <button
        type="button"
        className={cn(styles.toggle, active && styles.toggleOn)}
        onClick={() => (active ? setConfirming(true) : switchTo(true))}
        disabled={busy}
        aria-pressed={active}
        aria-label={label}
        title={label}
      >
        <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6.25 1.5h3.5" />
          <path d="M6.5 1.5v4.25L2.9 11.9a1.6 1.6 0 0 0 1.4 2.35h7.4a1.6 1.6 0 0 0 1.4-2.35L9.5 5.75V1.5" />
          <path d="M4.4 9.75h7.2" />
        </svg>
      </button>
      <ConfirmDialog
        open={confirming}
        title="Leave concept mode?"
        message="Everything changed while in concept mode — prices, stocks, accounts — is discarded, and the real portfolio comes back untouched."
        confirmLabel="Leave and discard"
        danger
        busy={busy}
        onConfirm={() => switchTo(false)}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};

export default ConceptToggle;
