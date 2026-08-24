import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { cn, formatDate, formatNumber, formatPrice, formatSignedPrice } from "@/lib/utils";
import type { HistoryEntry } from "@/types/api";
import styles from "./HistoryTable.module.scss";

type HistoryTableProps = {
  entries: HistoryEntry[];
  onEditSale: (entry: HistoryEntry) => void;
  onDeleteSale: (entry: HistoryEntry) => void;
};

function profitClass(value: number | null): string | undefined {
  if (value === null) return undefined;
  return value >= 0 ? styles.pos : styles.neg;
}

const HistoryTable: FC<HistoryTableProps> = ({ entries, onEditSale, onDeleteSale }): JSX.Element => (
  <div className={styles.wrapper}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Stock</th>
          <th>Account</th>
          <th className={styles.num}>Amount</th>
          <th className={styles.num}>Price</th>
          <th className={styles.num}>Total</th>
          <th className={styles.num}>Realized</th>
          <th>Reason</th>
          <th className={styles.actionsCell} aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={`${entry.kind}-${entry.id}`}>
            <td>{entry.date ? formatDate(entry.date) : "—"}</td>
            <td>
              <span className={entry.kind === "sell" ? styles.kindSell : styles.kindBuy}>
                {entry.kind === "sell" ? "Sell" : "Buy"}
              </span>
            </td>
            <td className={styles.ticker}>{entry.ticker}</td>
            <td>{entry.accountName}</td>
            <td className={styles.num}>
              {formatNumber(entry.quantity, 4)}
              {entry.kind === "buy" &&
              entry.remainingQuantity !== null &&
              entry.remainingQuantity !== entry.quantity ? (
                <span className={styles.caption}>
                  {entry.remainingQuantity > 0
                    ? `${formatNumber(entry.remainingQuantity, 4)} still held`
                    : "all sold"}
                </span>
              ) : null}
              {entry.unmatchedQuantity > 0 ? (
                <span className={cn(styles.caption, styles.warn)}>
                  {formatNumber(entry.unmatchedQuantity, 4)} without a purchase
                </span>
              ) : null}
            </td>
            <td className={styles.num}>{formatPrice(entry.price, entry.currency)}</td>
            <td className={styles.num}>{formatPrice(entry.total, entry.currency)}</td>
            <td className={cn(styles.num, styles.strong, profitClass(entry.realizedPl))}>
              {entry.realizedPl !== null ? (
                <>
                  {formatSignedPrice(entry.realizedPl, entry.currency)}
                  {entry.realizedPlEur !== null && entry.currency !== "EUR" ? (
                    <span className={styles.caption}>{formatSignedPrice(entry.realizedPlEur)}</span>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </td>
            <td>
              {entry.reason ? (
                <span className={styles.reason} title={entry.reason}>
                  {entry.reason}
                </span>
              ) : (
                "—"
              )}
            </td>
            <td className={styles.actionsCell}>
              {entry.kind === "sell" ? (
                <>
                  <button type="button" className={styles.action} onClick={() => onEditSale(entry)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={cn(styles.action, styles.actionDanger)}
                    onClick={() => onDeleteSale(entry)}
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default HistoryTable;
