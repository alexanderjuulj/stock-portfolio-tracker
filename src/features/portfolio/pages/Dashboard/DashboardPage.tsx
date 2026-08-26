import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { ConfirmDialog, Flex, Grid } from "@/components";
import { cn, formatDate, formatNumber, formatPercent, formatPrice, formatSignedPrice } from "@/lib/utils";
import type {
  AccountInput,
  AccountSummary,
  HoldingInput,
  PortfolioLot,
  PortfolioPosition,
  SaleInput,
} from "@/types/api";
import {
  AccountForm,
  AccountsTable,
  AccountTabs,
  HoldingForm,
  HoldingsTable,
  SectorChart,
  SellForm,
} from "../../components";
import { usePortfolio } from "../../hooks";
import styles from "./DashboardPage.module.scss";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatAsOf(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function signClass(value: number | null): string | undefined {
  if (value === null) return undefined;
  return value >= 0 ? styles.pos : styles.neg;
}

type HoldingFormState = { initial: PortfolioLot | null; presetTicker: string | null };
type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
};

const DashboardPage: FC = (): JSX.Element => {
  const [accountId, setAccountId] = useState<number | null>(null);
  const {
    data,
    loading,
    refreshing,
    error,
    refresh,
    addHolding,
    editHolding,
    removeHolding,
    removeStock,
    sell,
    addAccount,
    editAccount,
    removeAccount,
  } = usePortfolio(accountId);

  const [holdingForm, setHoldingForm] = useState<HoldingFormState | null>(null);
  const [holdingBusy, setHoldingBusy] = useState(false);
  const [holdingError, setHoldingError] = useState<string | null>(null);

  const [sellTarget, setSellTarget] = useState<{
    position: PortfolioPosition;
    accountId: number | null;
  } | null>(null);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

  const [accountForm, setAccountForm] = useState<{ initial: AccountSummary | null } | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const accounts = data?.accounts ?? [];
  const positions = data?.positions ?? [];
  const totals = data?.totals ?? null;
  const scopedAccount = accountId === null ? null : accounts.find((a) => a.id === accountId) ?? null;

  // ── Holding (lot) form ───────────────────────────────────────────────────

  const openAddStock = () => {
    setHoldingError(null);
    setHoldingForm({ initial: null, presetTicker: null });
  };
  const openAddLot = (position: PortfolioPosition) => {
    setHoldingError(null);
    setHoldingForm({ initial: null, presetTicker: position.ticker });
  };
  const openEditLot = (lot: PortfolioLot) => {
    setHoldingError(null);
    setHoldingForm({ initial: lot, presetTicker: null });
  };

  const submitHolding = (input: HoldingInput) => {
    if (!holdingForm) return;
    setHoldingBusy(true);
    setHoldingError(null);
    const save = holdingForm.initial
      ? editHolding(holdingForm.initial.id, input)
      : addHolding(input);
    save
      .then(() => setHoldingForm(null))
      .catch((err: unknown) => setHoldingError(errorMessage(err)))
      .finally(() => setHoldingBusy(false));
  };

  // ── Selling ──────────────────────────────────────────────────────────────

  const openSell = (position: PortfolioPosition, presetAccountId: number | null) => {
    setSellError(null);
    setSellTarget({ position, accountId: presetAccountId ?? accountId });
  };

  const submitSale = (input: SaleInput) => {
    setSellBusy(true);
    setSellError(null);
    sell(input)
      .then(() => setSellTarget(null))
      .catch((err: unknown) => setSellError(errorMessage(err)))
      .finally(() => setSellBusy(false));
  };

  // ── Account form ─────────────────────────────────────────────────────────

  const openAddAccount = () => {
    setAccountError(null);
    setAccountForm({ initial: null });
  };
  const openEditAccount = (account: AccountSummary) => {
    setAccountError(null);
    setAccountForm({ initial: account });
  };

  const submitAccount = (input: AccountInput) => {
    if (!accountForm) return;
    setAccountBusy(true);
    setAccountError(null);
    const save = accountForm.initial ? editAccount(accountForm.initial.id, input) : addAccount(input);
    save
      .then(() => setAccountForm(null))
      .catch((err: unknown) => setAccountError(errorMessage(err)))
      .finally(() => setAccountBusy(false));
  };

  // ── Deletions ────────────────────────────────────────────────────────────

  const confirmDeleteLot = (lot: PortfolioLot) =>
    setConfirmation({
      title: `Delete this ${lot.ticker} lot?`,
      message: `Removes ${formatNumber(lot.quantity, 4)} shares held in ${lot.accountName}${
        lot.purchasedAt ? ` (bought ${formatDate(lot.purchasedAt)})` : ""
      }.`,
      confirmLabel: "Delete lot",
      run: () => removeHolding(lot.id),
    });

  const confirmDeleteStock = (position: PortfolioPosition) =>
    setConfirmation({
      title: `Delete ${position.ticker}?`,
      message:
        position.lots.length === 1
          ? "Removes the position and its notes from the portfolio."
          : `Removes all ${position.lots.length} lots of ${position.ticker} across ${position.accountCount} ${
              position.accountCount === 1 ? "account" : "accounts"
            }, plus its notes.`,
      confirmLabel: "Delete",
      run: () => removeStock(position.ticker),
    });

  const confirmDeleteAccount = (account: AccountSummary) =>
    setConfirmation({
      title: `Delete ${account.name}?`,
      message:
        account.lotCount > 0
          ? `Removes the account together with the ${account.lotCount} ${
              account.lotCount === 1 ? "position" : "positions"
            } held in it.`
          : "Removes the account.",
      confirmLabel: "Delete account",
      run: async () => {
        if (accountId === account.id) setAccountId(null);
        await removeAccount(account.id);
      },
    });

  const runConfirmation = () => {
    if (!confirmation) return;
    setConfirmBusy(true);
    confirmation
      .run()
      .catch((err: unknown) => setActionError(errorMessage(err)))
      .finally(() => {
        setConfirmBusy(false);
        setConfirmation(null);
      });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const notices = [...(data?.errors ?? []), ...(actionError ? [actionError] : [])];
  const subline = loading
    ? "Loading holdings and prices…"
    : [
        `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`,
        `${positions.length} ${positions.length === 1 ? "position" : "positions"}`,
        data?.quotesAsOf ? `prices as of ${formatAsOf(data.quotesAsOf)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <main className={styles.page}>
      <Flex justify="between" align="end" gap="5" wrap="wrap">
        <div>
          <span className={styles.kicker}>
            Portfolio{scopedAccount ? ` · ${scopedAccount.name}` : ""}
          </span>
          <h1 className={styles.heroValue}>{totals ? formatPrice(totals.totalEur) : "…"}</h1>
          <p className={styles.subline}>{subline}</p>
        </div>
        <Flex gap="3" className={styles.toolbar}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => void refresh()}
            disabled={refreshing || loading}
          >
            {refreshing && !loading ? "Refreshing…" : "Refresh prices"}
          </button>
          <button type="button" className={styles.ghostButton} onClick={openAddAccount}>
            Add account
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={openAddStock}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? "Add an account first" : undefined}
          >
            Add stock
          </button>
        </Flex>
      </Flex>

      {accounts.length > 1 ? (
        <div className={styles.tabs}>
          <AccountTabs accounts={accounts} selected={accountId} onSelect={setAccountId} />
        </div>
      ) : null}

      {totals && (positions.length > 0 || accounts.length > 0) ? (
        <Grid columns={{ initial: "2", sm: "3", md: "6" }} gap="3" mt="6">
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Stocks</span>
            <span className={styles.tileValue}>{formatPrice(totals.stocksEur)}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Free cash</span>
            <span className={styles.tileValue}>{formatPrice(totals.cashEur)}</span>
            {totals.cashPct !== null ? (
              <span className={styles.tileHint} title="Share of stocks + cash">
                {formatPercent(totals.cashPct)} of portfolio
              </span>
            ) : null}
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Invested</span>
            <span className={styles.tileValue} title="Cost basis of open positions, at today's ECB rates">
              {formatPrice(totals.costEur)}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Open profit</span>
            <span
              className={cn(styles.tileValue, signClass(totals.profitEur))}
              title="Unrealized profit on the positions you still hold"
            >
              {formatSignedPrice(totals.profitEur)}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Realized</span>
            <span
              className={cn(styles.tileValue, signClass(totals.realizedEur))}
              title="Profit or loss from every sale, in EUR at the rate of the sale"
            >
              {formatSignedPrice(totals.realizedEur)}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Return</span>
            <span className={cn(styles.tileValue, signClass(totals.profitPct))}>
              {totals.profitPct !== null ? formatPercent(totals.profitPct, true) : "—"}
            </span>
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

      <section className={styles.section}>
        {loading ? (
          <p className={styles.stateText}>Loading…</p>
        ) : error && !data ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Couldn't load the portfolio</p>
            <p className={styles.emptyText}>{error}</p>
            <button type="button" className={styles.primaryButton} onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Start with an account</p>
            <p className={styles.emptyText}>
              Positions and free cash are tracked per account — a broker, a pension, a savings
              account. Add the first one, then add the stocks it holds.
            </p>
            <button type="button" className={styles.primaryButton} onClick={openAddAccount}>
              Add account
            </button>
          </div>
        ) : positions.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {scopedAccount ? `No stocks in ${scopedAccount.name} yet` : "No stocks yet"}
            </p>
            <p className={styles.emptyText}>
              Add a position to start tracking value and profit. Prices update automatically.
            </p>
            <button type="button" className={styles.primaryButton} onClick={openAddStock}>
              Add stock
            </button>
          </div>
        ) : data ? (
          <HoldingsTable
            positions={positions}
            totals={data.totals}
            onAddLot={openAddLot}
            onSell={openSell}
            onEditLot={openEditLot}
            onDeleteLot={confirmDeleteLot}
            onDeleteStock={confirmDeleteStock}
          />
        ) : null}
      </section>

      {data && data.sectors.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.kicker}>Sectors</span>
            <h2 className={styles.sectionTitle}>Where the stocks value sits</h2>
          </div>
          <SectorChart sectors={data.sectors} totalEur={data.totals.stocksEur} />
        </section>
      ) : null}

      {accounts.length > 0 ? (
        <section className={styles.section}>
          <Flex justify="between" align="end" gap="4" className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>Accounts</span>
              <h2 className={styles.sectionTitle}>Cash and value per account</h2>
            </div>
            <button type="button" className={styles.ghostButton} onClick={openAddAccount}>
              Add account
            </button>
          </Flex>
          <AccountsTable
            accounts={accounts}
            onEdit={openEditAccount}
            onDelete={confirmDeleteAccount}
          />
        </section>
      ) : null}

      <HoldingForm
        open={holdingForm !== null}
        initial={holdingForm?.initial ?? null}
        presetTicker={holdingForm?.presetTicker ?? null}
        defaultAccountId={accountId}
        accounts={accounts}
        stocks={data?.stocks ?? []}
        busy={holdingBusy}
        error={holdingError}
        onSubmit={submitHolding}
        onCancel={() => {
          if (!holdingBusy) setHoldingForm(null);
        }}
      />

      <SellForm
        open={sellTarget !== null}
        position={sellTarget?.position ?? null}
        initial={null}
        presetAccountId={sellTarget?.accountId ?? null}
        accounts={accounts}
        fxRates={data?.fxRates ?? {}}
        busy={sellBusy}
        error={sellError}
        onSubmit={submitSale}
        onCancel={() => {
          if (!sellBusy) setSellTarget(null);
        }}
      />

      <AccountForm
        open={accountForm !== null}
        initial={accountForm?.initial ?? null}
        busy={accountBusy}
        error={accountError}
        onSubmit={submitAccount}
        onCancel={() => {
          if (!accountBusy) setAccountForm(null);
        }}
      />

      <ConfirmDialog
        open={confirmation !== null}
        title={confirmation?.title ?? ""}
        message={confirmation?.message ?? ""}
        confirmLabel={confirmation?.confirmLabel ?? "Delete"}
        danger
        busy={confirmBusy}
        onConfirm={runConfirmation}
        onCancel={() => setConfirmation(null)}
      />
    </main>
  );
};

export default DashboardPage;
