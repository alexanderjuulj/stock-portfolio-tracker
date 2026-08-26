import { useEffect, useId, useRef, useState, type FC } from "react";
import { createPortal } from "react-dom";
import type { JSX } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
import styles from "./ActionMenu.module.scss";

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  /** Styles the item as destructive (red on hover). */
  danger?: boolean;
  /** Styles the item as the positive/primary action (accent on hover). */
  accent?: boolean;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  /** Accessible name for the trigger button. */
  label?: string;
};

type Anchor = { top: number; right: number };

/**
 * Three-dot trigger that opens a dropdown of actions. The menu is portalled
 * to `document.body` and positioned from the trigger's rect, so it is not
 * clipped by scrolling table wrappers.
 */
const ActionMenu: FC<ActionMenuProps> = ({ items, label = "Actions" }): JSX.Element => {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = anchor !== null;

  const toggle = () => {
    if (open) {
      setAnchor(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(styles.trigger, open && styles.triggerOpen)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
      >
        <span className={styles.dots} aria-hidden="true" />
      </button>
      {anchor
        ? createPortal(
            <div
              ref={menuRef}
              id={id}
              role="menu"
              className={styles.menu}
              style={{ top: anchor.top, right: anchor.right }}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={cn(
                    styles.item,
                    item.danger && styles.itemDanger,
                    item.accent && styles.itemAccent,
                  )}
                  onClick={() => {
                    setAnchor(null);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default ActionMenu;
