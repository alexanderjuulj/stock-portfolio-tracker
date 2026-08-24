import type { FC, ReactNode } from "react";
import type { JSX } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
import styles from "./Field.module.scss";

type FieldProps = {
  label: string;
  /** id of the control inside, so the label focuses it. */
  htmlFor?: string;
  hint?: string;
  /** Span both columns of a FormDialog grid. */
  full?: boolean;
  children: ReactNode;
};

/** Label + control + optional hint, stacked. */
const Field: FC<FieldProps> = ({ label, htmlFor, hint, full = false, children }): JSX.Element => (
  <div className={cn(styles.field, full && styles.full)}>
    <label className={styles.label} htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {hint ? <span className={styles.hint}>{hint}</span> : null}
  </div>
);

export default Field;
