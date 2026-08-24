import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { Field, FormDialog, fieldClasses } from "@/components";
import type { Account, AccountInput } from "@/types/api";
import CurrencySelect from "../CurrencySelect/CurrencySelect";

// Accepts both "1234.56" and the Danish-keyboard "1234,56".
function parseDecimal(value: string): number {
  return Number(value.trim().replace(/\s+/g, "").replace(",", "."));
}

type AccountFormProps = {
  open: boolean;
  /** Account being edited, or null when adding one. */
  initial: Account | null;
  busy: boolean;
  /** Submission error from the server. */
  error: string | null;
  onSubmit: (input: AccountInput) => void;
  onCancel: () => void;
};

const AccountFormDialog: FC<Omit<AccountFormProps, "open">> = ({
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}): JSX.Element => {
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "EUR");
  const [cash, setCash] = useState(initial ? String(initial.cash) : "0");
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    const cashValue = cash.trim() === "" ? 0 : parseDecimal(cash);
    if (!trimmed) {
      setValidationError("Account name is required");
      return;
    }
    if (!Number.isFinite(cashValue)) {
      setValidationError("Cash must be a number");
      return;
    }
    setValidationError(null);
    onSubmit({ name: trimmed, currency, cash: cashValue });
  };

  return (
    <FormDialog
      title={initial ? `Edit ${initial.name}` : "Add account"}
      submitLabel={initial ? "Save changes" : "Add account"}
      busy={busy}
      error={validationError ?? error}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Field label="Account name" htmlFor="account-name" full>
        <input
          id="account-name"
          className={fieldClasses.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nordnet, Saxo, pension…"
          autoFocus
          autoComplete="off"
        />
      </Field>
      <Field label="Cash currency" htmlFor="account-currency">
        <CurrencySelect id="account-currency" value={currency} onChange={setCurrency} />
      </Field>
      <Field label="Free cash" htmlFor="account-cash" hint="Uninvested money on the account">
        <input
          id="account-cash"
          className={fieldClasses.input}
          type="text"
          inputMode="decimal"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          placeholder="0"
          autoComplete="off"
        />
      </Field>
    </FormDialog>
  );
};

const AccountForm: FC<AccountFormProps> = ({ open, initial, ...rest }): JSX.Element | null =>
  open ? <AccountFormDialog key={initial?.id ?? "new"} initial={initial} {...rest} /> : null;

export default AccountForm;
