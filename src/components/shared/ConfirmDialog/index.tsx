import { useEffect, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { Flex, Text } from "@/components/ui";
import styles from "./ConfirmDialog.module.scss";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button for a destructive action. */
  danger?: boolean;
  /** Disables both buttons while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}): JSX.Element | null => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={busy ? undefined : onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <Flex direction="column" gap="3">
          <Text className={styles.title}>{title}</Text>
          <Text className={styles.message}>{message}</Text>
          <Flex className={styles.actions} justify="end" gap="3">
            <button
              className={styles.cancel}
              type="button"
              disabled={busy}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              className={danger ? styles.confirmDanger : styles.confirm}
              type="button"
              disabled={busy}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </Flex>
        </Flex>
      </div>
    </div>
  );
};

export default ConfirmDialog;
