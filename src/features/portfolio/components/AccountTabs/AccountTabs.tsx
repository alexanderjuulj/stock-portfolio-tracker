import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/api";
import styles from "./AccountTabs.module.scss";

type AccountTabsProps = {
  accounts: Account[];
  /** Selected account id, or null for "all accounts". */
  selected: number | null;
  onSelect: (accountId: number | null) => void;
};

const AccountTabs: FC<AccountTabsProps> = ({ accounts, selected, onSelect }): JSX.Element => (
  <div className={styles.tabs} role="tablist" aria-label="Account">
    <button
      type="button"
      role="tab"
      aria-selected={selected === null}
      className={cn(styles.tab, selected === null && styles.tabActive)}
      onClick={() => onSelect(null)}
    >
      All accounts
    </button>
    {accounts.map((account) => (
      <button
        key={account.id}
        type="button"
        role="tab"
        aria-selected={selected === account.id}
        className={cn(styles.tab, selected === account.id && styles.tabActive)}
        onClick={() => onSelect(account.id)}
      >
        {account.name}
      </button>
    ))}
  </div>
);

export default AccountTabs;
