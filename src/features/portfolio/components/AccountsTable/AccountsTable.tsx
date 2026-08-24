import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { cn, formatPrice } from "@/lib/utils";
import type { AccountSummary } from "@/types/api";
import styles from "./AccountsTable.module.scss";

type AccountsTableProps = {
  accounts: AccountSummary[];
  onEdit: (account: AccountSummary) => void;
  onDelete: (account: AccountSummary) => void;
};

const AccountsTable: FC<AccountsTableProps> = ({ accounts, onEdit, onDelete }): JSX.Element => {
  const cashEur = accounts.reduce((sum, a) => sum + (a.cashEur ?? 0), 0);
  const stocksEur = accounts.reduce((sum, a) => sum + a.stocksEur, 0);
  const lots = accounts.reduce((sum, a) => sum + a.lotCount, 0);

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Account</th>
            <th className={styles.num}>Free cash</th>
            <th className={styles.num}>Cash €</th>
            <th className={styles.num}>Stocks €</th>
            <th className={styles.num}>Total €</th>
            <th className={styles.num}>Lots</th>
            <th className={styles.actionsCell} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td className={styles.name}>{account.name}</td>
              <td className={styles.num}>{formatPrice(account.cash, account.currency)}</td>
              <td
                className={styles.num}
                title={account.cashEur === null ? `No EUR rate for ${account.currency}` : undefined}
              >
                {account.cashEur !== null ? formatPrice(account.cashEur) : "—"}
              </td>
              <td className={styles.num}>{formatPrice(account.stocksEur)}</td>
              <td className={cn(styles.num, styles.strong)}>
                {account.totalEur !== null ? formatPrice(account.totalEur) : "—"}
              </td>
              <td className={styles.num}>{account.lotCount}</td>
              <td className={styles.actionsCell}>
                <button type="button" className={styles.action} onClick={() => onEdit(account)}>
                  Edit
                </button>
                <button
                  type="button"
                  className={cn(styles.action, styles.actionDanger)}
                  onClick={() => onDelete(account)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        {accounts.length > 1 ? (
          <tfoot>
            <tr>
              <td>All accounts</td>
              <td />
              <td className={styles.num}>{formatPrice(cashEur)}</td>
              <td className={styles.num}>{formatPrice(stocksEur)}</td>
              <td className={styles.num}>{formatPrice(cashEur + stocksEur)}</td>
              <td className={styles.num}>{lots}</td>
              <td />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
};

export default AccountsTable;
