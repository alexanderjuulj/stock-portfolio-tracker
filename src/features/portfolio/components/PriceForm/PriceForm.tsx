import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { Field, FormDialog, fieldClasses } from "@/components";
import type { PortfolioPosition } from "@/types/api";

// Accepts both "1234.56" and the Danish-keyboard "1234,56".
function parseDecimal(value: string): number {
  return Number(value.trim().replace(/\s+/g, "").replace(",", "."));
}

// Concept mode only: pins a hand-set market price on the position's ticker.
// Every derived figure — profit, value, weight, totals — recomputes from it.
type PriceFormProps = {
  open: boolean;
  position: PortfolioPosition | null;
  busy: boolean;
  /** Submission error from the server. */
  error: string | null;
  onSubmit: (price: number) => void;
  onCancel: () => void;
};

const PriceFormDialog: FC<Omit<PriceFormProps, "open" | "position"> & {
  position: PortfolioPosition;
}> = ({ position, busy, error, onSubmit, onCancel }): JSX.Element => {
  const [price, setPrice] = useState(
    position.marketPrice !== null ? String(position.marketPrice) : "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = () => {
    const value = parseDecimal(price);
    if (price.trim() === "" || !Number.isFinite(value) || value <= 0) {
      setValidationError("Price must be a positive number");
      return;
    }
    setValidationError(null);
    onSubmit(value);
  };

  return (
    <FormDialog
      title={`Set ${position.ticker} price`}
      submitLabel="Set price"
      busy={busy}
      error={validationError ?? error}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Field
        label={`Market price (${position.currencyEffective})`}
        htmlFor="concept-price"
        hint="A concept price: pinned until you reset it or leave concept mode"
        full
      >
        <input
          id="concept-price"
          className={fieldClasses.input}
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="800"
          autoFocus
          autoComplete="off"
        />
      </Field>
    </FormDialog>
  );
};

const PriceForm: FC<PriceFormProps> = ({ open, position, ...rest }): JSX.Element | null =>
  open && position ? <PriceFormDialog key={position.ticker} position={position} {...rest} /> : null;

export default PriceForm;
