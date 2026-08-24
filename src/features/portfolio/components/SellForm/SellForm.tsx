import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { Field, FormDialog, fieldClasses } from "@/components";
import {
  cn,
  formatNumber,
  formatPrice,
  formatSignedPrice,
  todayIsoDate,
} from "@/lib/utils";
import type { Account, PortfolioLot, PortfolioPosition, Sale, SaleInput } from "@/types/api";
import styles from "./SellForm.module.scss";

// Accepts both "1234.56" and the Danish-keyboard "1234,56".
function parseDecimal(value: string): number {
  return Number(value.trim().replace(/\s+/g, "").replace(",", "."));
}

function formatForInput(value: number): string {
  return String(Number(value.toFixed(4)));
}

type Holder = { id: number; name: string; available: number; lots: PortfolioLot[] };

/** Accounts holding the position, with what each one can sell. */
function holdersOf(position: PortfolioPosition): Holder[] {
  const byAccount = new Map<number, Holder>();
  for (const lot of position.lots) {
    const holder = byAccount.get(lot.accountId) ?? {
      id: lot.accountId,
      name: lot.accountName,
      available: 0,
      lots: [],
    };
    holder.available += lot.quantity;
    holder.lots.push(lot);
    byAccount.set(lot.accountId, holder);
  }
  return [...byAccount.values()];
}

/** Cost of selling `quantity` from these lots, oldest first — mirrors the server's FIFO. */
function fifoCost(lots: PortfolioLot[], quantity: number): number {
  const sorted = [...lots].sort(
    (a, b) => (a.purchasedAt ?? "").localeCompare(b.purchasedAt ?? "") || a.id - b.id,
  );
  let need = quantity;
  let cost = 0;
  for (const lot of sorted) {
    if (need <= 0) break;
    const take = Math.min(need, lot.quantity);
    cost += take * lot.purchasePrice;
    need -= take;
  }
  return cost;
}

type SellFormProps = {
  open: boolean;
  /** Position being sold — for a new sale. */
  position: PortfolioPosition | null;
  /** Existing sale being edited; amount, price, date, reason and cash credit can change. */
  initial: (Sale & { accountName: string }) | null;
  /** Account to preselect for a new sale (from a lot row or the active filter). */
  presetAccountId?: number | null;
  accounts: Account[];
  /** EUR per unit per currency — to preview what lands in the account's cash. */
  fxRates?: Record<string, number>;
  busy: boolean;
  /** Submission error from the server. */
  error: string | null;
  onSubmit: (input: SaleInput) => void;
  onCancel: () => void;
};

const SellFormDialog: FC<Omit<SellFormProps, "open">> = ({
  position,
  initial,
  presetAccountId = null,
  accounts,
  fxRates = {},
  busy,
  error,
  onSubmit,
  onCancel,
}): JSX.Element => {
  const ticker = initial?.ticker ?? position?.ticker ?? "";
  const holders = position ? holdersOf(position) : [];
  const presetHolder = holders.find((h) => h.id === presetAccountId) ?? null;

  const [accountId, setAccountId] = useState<string>(
    initial
      ? String(initial.accountId)
      : presetHolder
        ? String(presetHolder.id)
        : holders.length === 1
          ? String(holders[0].id)
          : "",
  );
  const [quantity, setQuantity] = useState(initial ? formatForInput(initial.quantity) : "");
  const [price, setPrice] = useState(
    initial
      ? formatForInput(initial.price)
      : position?.marketPrice !== null && position?.marketPrice !== undefined
        ? formatForInput(position.marketPrice)
        : "",
  );
  const [soldAt, setSoldAt] = useState(initial?.soldAt ?? todayIsoDate());
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [creditCash, setCreditCash] = useState(initial ? initial.cashCredited !== null : true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const accountValue = Number(accountId);
  const holder = holders.find((h) => h.id === accountValue) ?? null;
  const account = accounts.find((a) => a.id === accountValue) ?? null;
  const accountName = account?.name ?? initial?.accountName ?? "";
  const currency = initial?.currency ?? position?.currencyEffective ?? "";

  const quantityValue = parseDecimal(quantity);
  const priceValue = parseDecimal(price);
  const amountsValid =
    quantity.trim() !== "" &&
    price.trim() !== "" &&
    Number.isFinite(quantityValue) &&
    quantityValue > 0 &&
    Number.isFinite(priceValue) &&
    priceValue >= 0;
  const proceeds = amountsValid ? quantityValue * priceValue : null;
  const costBasis =
    proceeds !== null && holder && quantityValue <= holder.available
      ? fifoCost(holder.lots, quantityValue)
      : null;
  const realized = proceeds !== null && costBasis !== null ? proceeds - costBasis : null;

  let cashCredit: number | null = null;
  let cashCreditNote: string | null = null;
  if (proceeds !== null && account) {
    if (currency === account.currency) {
      cashCredit = proceeds;
    } else {
      const from = fxRates[currency];
      const to = fxRates[account.currency];
      if (from !== undefined && to !== undefined) cashCredit = (proceeds * from) / to;
      else cashCreditNote = initial ? null : `No ${currency}→${account.currency} rate available`;
    }
  }

  const submit = () => {
    if (!account) {
      setValidationError(holders.length > 1 ? "Choose which account you're selling from" : "Account is missing");
      return;
    }
    if (!amountsValid) {
      setValidationError(
        quantity.trim() === "" || !Number.isFinite(quantityValue) || quantityValue <= 0
          ? "Amount must be a number greater than 0"
          : "Price must be a number",
      );
      return;
    }
    if (holder && quantityValue > holder.available + 1e-9) {
      setValidationError(`Only ${formatNumber(holder.available, 4)} ${ticker} shares are held in ${holder.name}`);
      return;
    }
    if (!soldAt) {
      setValidationError("Sale date is required");
      return;
    }
    if (!reason.trim()) {
      setValidationError("Give a reason for selling — future you will want to know");
      return;
    }
    setValidationError(null);
    onSubmit({
      ticker,
      accountId: account.id,
      quantity: quantityValue,
      price: priceValue,
      soldAt,
      reason: reason.trim(),
      creditCash,
    });
  };

  const priceHint = initial
    ? `In ${currency}`
    : position?.marketPrice !== null && position?.marketPrice !== undefined
      ? `Market price ${formatPrice(position.marketPrice, currency)}${
          position.quoteFetchedAt
            ? ` as of ${new Date(position.quoteFetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""
        }`
      : "No current price — enter the price you got";

  return (
    <FormDialog
      title={initial ? `Edit ${ticker} sale` : `Sell ${ticker}`}
      submitLabel={initial ? "Save changes" : "Record sale"}
      busy={busy}
      error={validationError ?? error}
      onSubmit={submit}
      onCancel={onCancel}
    >
      {initial ? (
        <Field label="Sold from" full>
          <span className={styles.static}>{accountName}</span>
        </Field>
      ) : (
        <Field
          label="Sell from"
          htmlFor="sale-account"
          full
          hint={holders.length > 1 ? `${ticker} is held in ${holders.length} accounts` : undefined}
        >
          <select
            id="sale-account"
            className={fieldClasses.select}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            autoFocus={holders.length > 1}
          >
            {holders.length > 1 ? <option value="">Choose account…</option> : null}
            {holders.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} — {formatNumber(h.available, 4)} shares
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="Amount of stocks"
        htmlFor="sale-quantity"
        hint={holder ? `Up to ${formatNumber(holder.available, 4)} in ${holder.name}` : undefined}
      >
        <input
          id="sale-quantity"
          className={fieldClasses.input}
          type="text"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="10"
          autoFocus={holders.length <= 1}
          autoComplete="off"
        />
      </Field>

      <Field label="Price per share" htmlFor="sale-price" hint={priceHint}>
        <input
          id="sale-price"
          className={fieldClasses.input}
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          autoComplete="off"
        />
      </Field>

      <Field label="Sale date" htmlFor="sale-date" full>
        <input
          id="sale-date"
          className={fieldClasses.input}
          type="date"
          value={soldAt}
          onChange={(e) => setSoldAt(e.target.value)}
        />
      </Field>

      <Field label="Reason for selling" htmlFor="sale-reason" full>
        <textarea
          id="sale-reason"
          className={fieldClasses.textarea}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Taking profit, rebalancing, thesis changed…"
          rows={2}
        />
      </Field>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={creditCash}
          onChange={(e) => setCreditCash(e.target.checked)}
        />
        <span>
          Add the proceeds to {accountName || "the account"}&apos;s free cash
          {cashCredit !== null && account ? (
            <span className={styles.checkboxNote}>
              {" "}
              · {currency === account.currency ? "" : "≈ "}
              {formatPrice(cashCredit, account.currency)}
            </span>
          ) : cashCreditNote ? (
            <span className={styles.checkboxNote}> · {cashCreditNote}</span>
          ) : null}
        </span>
      </label>

      {!initial && proceeds !== null ? (
        <div className={styles.preview}>
          <div className={styles.previewRow}>
            <span>Proceeds</span>
            <span>{formatPrice(proceeds, currency)}</span>
          </div>
          <div className={styles.previewRow}>
            <span>Cost basis · oldest lots first</span>
            <span>{costBasis !== null ? formatPrice(costBasis, currency) : "—"}</span>
          </div>
          <div className={cn(styles.previewRow, styles.previewTotal)}>
            <span>Realized profit</span>
            <span className={realized === null ? undefined : realized >= 0 ? styles.pos : styles.neg}>
              {realized !== null ? formatSignedPrice(realized, currency) : "—"}
            </span>
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
};

const SellForm: FC<SellFormProps> = ({ open, position, initial, presetAccountId, ...rest }): JSX.Element | null =>
  open ? (
    <SellFormDialog
      key={initial ? `sale-${initial.id}` : `${position?.ticker ?? ""}-${presetAccountId ?? "any"}`}
      position={position}
      initial={initial}
      presetAccountId={presetAccountId}
      {...rest}
    />
  ) : null;

export default SellForm;
