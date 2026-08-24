import styles from "./Field.module.scss";

/** Class names for the form controls that go inside a `Field`. */
export const fieldClasses = {
  input: styles.input,
  select: styles.select,
  textarea: styles.textarea,
} as const;
