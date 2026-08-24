import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { ConfirmDialog, Flex, Grid } from "@/components";
import { cn, formatDate, formatNumber, formatPrice, formatSignedPrice } from "@/lib/utils";
import type { HistoryEntry, Sale, SaleInput } from "@/types/api";
import { AccountTabs, HistoryTable, RealizedTable, SellForm } from "../../components";
import { useHistory } from "../../hooks";
import styles from "./HistoryPage.module.scss";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The sale an entry stands for, in the shape the edit form wants. */
function saleOf(entry: HistoryEntry): Sale & { accountName: string } {
  return {
    id: entry.id,
    ticker: entry.ticker,
    accountId: entry.accountId,
    accountName: entry.accountName,
    quantity: entry.quantity,
    price: entry.price,
    currency: entry.currency,
    eurPerUnit: null,
    cashCredited: entry.cashCredited,
    reason: entry.reason,
    soldAt: entry.date ?? "",
  };
}

const HistoryPage: FC = (): JSX.Element => {
  const [accountId, setAccountId] = useState<number | null>(null);
  const { data, loading, error, reload, editSale, removeSale } = useHistory(accountId);

  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<HistoryEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const accounts = data?.accounts ?? [];
  const entries = data?.entries ?? [];
  const totals = data?.totals ?? null;
  const scopedAccount = accountId === null ? null : accounts.find((a) => a.id === accountId) ?? null;

  const submitEdit = (input: SaleInput) => {
    if (!editing) return;
    setEditBusy(true);
    setEditError(null);
    editSale(editing.id, input)
      .then(() => setEditing(null))
      .catch((err: unknown) => setEditError(errorMessage(err)))
      .finally(() => setEditBusy(false));
  };

  const confirmDelete = () => {
    if (!deleting) return;
    setDeleteBusy(true);
    removeSale(deleting.id)
      .catch((err: unknown) => setActionError(errorMessage(err)))
      .finally(() => {
        setDeleteBusy(false);
        setDeleting(null);
      });
  };

  const notices = [...(data?.errors ?? []), ...(actionError ? [actionError] : [])];
  const subline = loading
    ? "Loading transactions…"
    : totals
      ? `${totals.buys} ${totals.buys === 1 ? "purchase" : "purchases"} · ${totals.sales} ${
          totals.sales === 1 ? "sale" : "sales"
        }`
      : "";

  return (
    <main className={styles.page}>
      <Flex justify="between" align="end" gap="5" wrap="wrap">
        <div>
          <span className={styles.kicker}>
            Portfolio{scopedAccount ? ` · ${scopedAccount.name}` : ""}
          </span>
          <h1 className={styles.heading}>History</h1>
          <p className={styles.subline}>{subline}</p>
        </div>
      </Flex>

      {accounts.length > 1 ? (
        <div className={styles.tabs}>
          <AccountTabs accounts={accounts} selected={accountId} onSelect={setAccountId} />
        </div>
      ) : null}

      {totals && entries.length > 0 ? (
        <Grid columns={{ initial: "1", sm: "3" }} gap="3" mt="6">
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Realized profit</span>
            <span
              className={cn(styles.tileValue, totals.realizedEur >= 0 ? styles.pos : styles.neg)}
              title="Sum of every sale's profit or loss, in EUR at the rate of the sale"
            >
              {formatSignedPrice(totals.realizedEur)}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Sales</span>
            <span className={styles.tileValue}>{totals.sales}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Purchases</span>
            <span className={styles.tileValue}>{totals.buys}</span>
          </div>
        </Grid>
      ) : null}

      {notices.length > 0 ? (
        <div className={styles.notice}>
          {notices.map((notice) => (
            <p key={notice} className={styles.noticeLine}>
              {notice}
            </p>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className={styles.stateText}>Loading…</p>
      ) : error && !data ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Couldn't load the history</p>
          <p className={styles.emptyText}>{error}</p>
          <button type="button" className={styles.primaryButton} onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {scopedAccount ? `Nothing recorded for ${scopedAccount.name} yet` : "No transactions yet"}
          </p>
          <p className={styles.emptyText}>
            Purchases you add on the dashboard show up here, and every sale with the profit or
            loss it realized.
          </p>
        </div>
      ) : (
        <>
          {data && data.realized.length > 0 ? (
            <section className={styles.section}>
              <span className={styles.kicker}>Realized</span>
              <h2 className={styles.sectionTitle}>Profit and loss per stock and account</h2>
              <RealizedTable rows={data.realized} />
            </section>
          ) : null}

          <section className={styles.section}>
            <span className={styles.kicker}>Transactions</span>
            <h2 className={styles.sectionTitle}>Every purchase and sale, newest first</h2>
            <HistoryTable entries={entries} onEditSale={setEditing} onDeleteSale={setDeleting} />
          </section>
        </>
      )}

      <SellForm
        open={editing !== null}
        position={null}
        initial={editing ? saleOf(editing) : null}
        accounts={accounts}
        busy={editBusy}
        error={editError}
        onSubmit={submitEdit}
        onCancel={() => {
          if (!editBusy) setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete this ${deleting.ticker} sale?` : ""}
        message={
          deleting
            ? `The ${formatNumber(deleting.quantity, 4)} shares sold${
                deleting.date ? ` on ${formatDate(deleting.date)}` : ""
              } count as held again${
                deleting.cashCredited !== null
                  ? `, and the ${formatPrice(
                      deleting.cashCredited,
                      accounts.find((a) => a.id === deleting.accountId)?.currency ?? "EUR",
                    )} it added to ${deleting.accountName}'s free cash is taken back`
                  : ""
              }.`
            : ""
        }
        confirmLabel="Delete sale"
        danger
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </main>
  );
};

export default HistoryPage;
