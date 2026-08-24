import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { cn, formatNumber, formatPrice, formatSignedPrice } from "@/lib/utils";
import type { RealizedByPosition } from "@/types/api";
import styles from "./RealizedTable.module.scss";

type RealizedTableProps = {
  rows: RealizedByPosition[];
};

function profitClass(value: number | null): string | undefined {
  if (value === null) return undefined;
  return value >= 0 ? styles.pos : styles.neg;
}

/** Realized P/L per stock × account. */
const RealizedTable: FC<RealizedTableProps> = ({ rows }): JSX.Element => {
  const totalEur = rows.reduce((sum, r) => sum + (r.realizedPlEur ?? 0), 0);
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Stock</th>
            <th>Account</th>
            <th className={styles.num}>Sold</th>
            <th className={styles.num}>Proceeds</th>
            <th className={styles.num}>Cost basis</th>
            <th className={styles.num}>Realized</th>
            <th className={styles.num}>Realized €</th>
            <th className={styles.num}>Sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.accountId}-${row.ticker}`}>
              <td className={styles.ticker}>{row.ticker}</td>
              <td>{row.accountName}</td>
              <td className={styles.num}>{formatNumber(row.soldQuantity, 4)}</td>
              <td className={styles.num}>{formatPrice(row.proceeds, row.currency)}</td>
              <td className={styles.num}>{formatPrice(row.costBasis, row.currency)}</td>
              <td className={cn(styles.num, styles.strong, profitClass(row.realizedPl))}>
                {formatSignedPrice(row.realizedPl, row.currency)}
              </td>
              <td className={cn(styles.num, styles.strong, profitClass(row.realizedPlEur))}>
                {row.realizedPlEur !== null ? formatSignedPrice(row.realizedPlEur) : "—"}
              </td>
              <td className={styles.num}>{row.salesCount}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 1 ? (
          <tfoot>
            <tr>
              <td colSpan={6}>Total</td>
              <td className={cn(styles.num, profitClass(totalEur))}>{formatSignedPrice(totalEur)}</td>
              <td className={styles.num}>{rows.reduce((sum, r) => sum + r.salesCount, 0)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
};

export default RealizedTable;
