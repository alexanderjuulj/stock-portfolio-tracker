import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { Field, FormDialog, fieldClasses } from "@/components";
import type { Account, Holding, HoldingInput, Stock } from "@/types/api";
import CurrencySelect from "../CurrencySelect/CurrencySelect";
import SectorSelect from "../SectorSelect/SectorSelect";

// Accepts both "1234.56" and the Danish-keyboard "1234,56".
function parseDecimal(value: string): number {
  return Number(value.trim().replace(/\s+/g, "").replace(",", "."));
}

type HoldingFormProps = {
  open: boolean;
  /** Lot being edited, or null when adding one. */
  initial: Holding | null;
  /** Ticker to start from when adding another lot of an existing stock. */
  presetTicker?: string | null;
  /** Account to preselect when adding (e.g. the active account filter). */
  defaultAccountId?: number | null;
  accounts: Account[];
  /** Every stock on record — drives ticker suggestions and sector/notes prefill. */
  stocks: Stock[];
  busy: boolean;
  /** Submission error from the server. */
  error: string | null;
  onSubmit: (input: HoldingInput) => void;
  onCancel: () => void;
};

const HoldingFormDialog: FC<Omit<HoldingFormProps, "open">> = ({
  initial,
  presetTicker = null,
  defaultAccountId = null,
  accounts,
  stocks,
  busy,
  error,
  onSubmit,
  onCancel,
}): JSX.Element => {
  const startTicker = initial?.ticker ?? presetTicker ?? "";
  const startStock = stocks.find((s) => s.ticker === startTicker) ?? null;

  const [ticker, setTicker] = useState(startTicker);
  const [accountId, setAccountId] = useState(
    String(initial?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? ""),
  );
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "");
  const [purchasePrice, setPurchasePrice] = useState(initial ? String(initial.purchasePrice) : "");
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ?? "");
  // Stock-level fields, prefilled from the matching stock record.
  const [sector, setSector] = useState(startStock?.sector ?? "");
  const [currency, setCurrency] = useState(startStock?.currency ?? "USD");
  const [notes, setNotes] = useState(startStock?.notes ?? "");
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(startStock?.ticker ?? null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const normalizedTicker = ticker.trim().toUpperCase();
  const matchedStock = stocks.find((s) => s.ticker === normalizedTicker) ?? null;
  const knownSectors = [...new Set(stocks.map((s) => s.sector))];

  const changeTicker = (value: string) => {
    setTicker(value);
    const match = stocks.find((s) => s.ticker === value.trim().toUpperCase());
    if (match && match.ticker !== prefilledFrom) {
      setSector(match.sector);
      setCurrency(match.currency);
      setNotes(match.notes);
      setPrefilledFrom(match.ticker);
    }
  };

  const submit = () => {
    const quantityValue = parseDecimal(quantity);
    const priceValue = parseDecimal(purchasePrice);
    const accountValue = Number(accountId);
    if (!normalizedTicker) {
      setValidationError("Ticker is required");
      return;
    }
    if (!accounts.some((a) => a.id === accountValue)) {
      setValidationError("Pick the account that holds this position");
      return;
    }
    if (quantity.trim() === "" || !Number.isFinite(quantityValue) || quantityValue <= 0) {
      setValidationError("Amount must be a number greater than 0");
      return;
    }
    if (purchasePrice.trim() === "" || !Number.isFinite(priceValue) || priceValue < 0) {
      setValidationError("Purchase price must be a number");
      return;
    }
    setValidationError(null);
    onSubmit({
      ticker: normalizedTicker,
      accountId: accountValue,
      quantity: quantityValue,
      purchasePrice: priceValue,
      purchasedAt: purchasedAt || null,
      stock: { sector: sector.trim(), currency, notes: notes.trim() },
    });
  };

  const sharedHint = matchedStock ? `Shared by every ${matchedStock.ticker} lot` : undefined;

  return (
    <FormDialog
      title={
        initial ? `Edit ${initial.ticker} lot` : presetTicker ? `Add ${presetTicker} lot` : "Add stock"
      }
      submitLabel={initial ? "Save changes" : "Add"}
      busy={busy}
      error={validationError ?? error}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Field label="Ticker" htmlFor="holding-ticker" hint="Yahoo symbol — AAPL, NOVO-B.CO, …">
        <input
          id="holding-ticker"
          className={fieldClasses.input}
          type="text"
          value={ticker}
          onChange={(e) => changeTicker(e.target.value)}
          list="holding-ticker-options"
          placeholder="AMD"
          autoFocus={!presetTicker}
          autoComplete="off"
          spellCheck={false}
        />
        <datalist id="holding-ticker-options">
          {stocks.map((s) => (
            <option key={s.ticker} value={s.ticker} />
          ))}
        </datalist>
      </Field>

      <Field label="Account" htmlFor="holding-account">
        <select
          id="holding-account"
          className={fieldClasses.select}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Amount of stocks" htmlFor="holding-quantity">
        <input
          id="holding-quantity"
          className={fieldClasses.input}
          type="text"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="10"
          autoFocus={Boolean(presetTicker)}
          autoComplete="off"
        />
      </Field>

      <Field label="Purchase price per share" htmlFor="holding-price">
        <input
          id="holding-price"
          className={fieldClasses.input}
          type="text"
          inputMode="decimal"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="184,50"
          autoComplete="off"
        />
      </Field>

      <Field label="Purchase date" htmlFor="holding-date">
        <input
          id="holding-date"
          className={fieldClasses.input}
          type="date"
          value={purchasedAt}
          onChange={(e) => setPurchasedAt(e.target.value)}
        />
      </Field>

      <Field
        label="Currency"
        htmlFor="holding-currency"
        hint={sharedHint ?? "Used when the price source doesn't report one"}
      >
        <CurrencySelect id="holding-currency" value={currency} onChange={setCurrency} />
      </Field>

      <Field label="Sector" htmlFor="holding-sector" hint={sharedHint} full>
        <SectorSelect
          id="holding-sector"
          value={sector}
          onChange={setSector}
          knownSectors={knownSectors}
        />
      </Field>

      <Field label="Personal notes" htmlFor="holding-notes" hint={sharedHint} full>
        <textarea
          id="holding-notes"
          className={fieldClasses.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why you bought it, exit plan, …"
          rows={3}
        />
      </Field>
    </FormDialog>
  );
};

const HoldingForm: FC<HoldingFormProps> = ({
  open,
  initial,
  presetTicker,
  ...rest
}): JSX.Element | null =>
  open ? (
    <HoldingFormDialog
      key={initial?.id ?? presetTicker ?? "new"}
      initial={initial}
      presetTicker={presetTicker}
      {...rest}
    />
  ) : null;

export default HoldingForm;
