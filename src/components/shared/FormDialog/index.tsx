import { useEffect, type FC, type FormEvent, type ReactNode } from "react";
import type { JSX } from "react/jsx-runtime";
import styles from "./FormDialog.module.scss";

type FormDialogProps = {
  title: string;
  /** Disables both buttons while the submit runs. */
  busy?: boolean;
  /** Error line shown above the actions (validation or server). */
  error?: string | null;
  submitLabel: string;
  cancelLabel?: string;
  onSubmit: () => void;
  onCancel: () => void;
  /** Fields — laid out on a two-column grid; wrap each in a `Field`. */
  children: ReactNode;
};

/**
 * Modal form shell: backdrop, panel, title, error line, Cancel/Submit row.
 * Mount it only while open, so the field state in `children` starts fresh on
 * every open.
 */
const FormDialog: FC<FormDialogProps> = ({
  title,
  busy = false,
  error = null,
  submitLabel,
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
  children,
}): JSX.Element => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className={styles.backdrop} onClick={busy ? undefined : onCancel}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className={styles.title}>{title}</div>
        <div className={styles.body}>{children}</div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <button className={styles.cancel} type="button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormDialog;
