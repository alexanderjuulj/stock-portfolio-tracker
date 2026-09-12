import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { ActionMenu } from "@/components";
import {
  cn,
  formatDate,
  formatNumber,
  formatPercent,
  formatPrice,
  formatQuote,
  formatSignedPrice,
} from "@/lib/utils";
import type { PortfolioLot, PortfolioPosition, PortfolioTotals } from "@/types/api";
import styles from "./HoldingsTable.module.scss";

type HoldingsTableProps = {
  positions: PortfolioPosition[];
  totals: PortfolioTotals;
  onAddLot: (position: PortfolioPosition) => void;
  /** Sell shares of the position; `accountId` preselects the account when known. */
  onSell: (position: PortfolioPosition, accountId: number | null) => void;
  onEditLot: (lot: PortfolioLot) => void;
  onDeleteLot: (lot: PortfolioLot) => void;
  /** Removes the stock and all of its lots. */
  onDeleteStock: (position: PortfolioPosition) => void;
  /** Concept mode: pin a hand-set market price. Null hides the action. */
  onSetPrice: ((position: PortfolioPosition) => void) | null;
  /** Concept mode: drop the hand-set price. Null hides the action. */
  onClearPrice: ((position: PortfolioPosition) => void) | null;
};

function profitClass(value: number | null): string | undefined {
  if (value === null) return undefined;
  return value >= 0 ? styles.pos : styles.neg;
}

const HoldingsTable: FC<HoldingsTableProps> = ({
  positions,
  totals,
  onAddLot,
  onSell,
  onEditLot,
  onDeleteLot,
  onDeleteStock,
  onSetPrice,
  onClearPrice,
}): JSX.Element => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const hasTotals = positions.some((p) => p.marketValueEur !== null);

  const toggle = (ticker: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Stock</th>
            <th className={styles.num}>Amount</th>
            <th className={styles.num}>Avg buy</th>
            <th className={styles.num}>Price</th>
            <th className={styles.num}>Profit</th>
            <th className={styles.num}>Profit %</th>
            <th className={styles.num}>Value</th>
            <th className={styles.num}>Value €</th>
            <th className={styles.num}>Weight</th>
            <th className={styles.num} title="Price change since the previous close">
              Day %
            </th>
            <th>Sector</th>
            <th>Notes</th>
            <th className={styles.actionsCell} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const isOpen = expanded.has(p.ticker);
            const currency = p.currencyEffective;
            return [
              <tr key={p.ticker}>
                <td>
                  <button
                    type="button"
                    className={styles.toggle}
                    aria-expanded={isOpen}
                    onClick={() => toggle(p.ticker)}
                  >
                    <span className={cn(styles.caret, isOpen && styles.caretOpen)} />
                    <span className={styles.ticker}>{p.ticker}</span>
                  </button>
                  {p.name ? (
                    <span className={styles.name} title={p.name}>
                      {p.name}
                    </span>
                  ) : null}
                  {p.lots.length > 1 ? (
                    <span className={styles.lotsCaption}>
                      {p.lots.length} lots · {p.accountCount}{" "}
                      {p.accountCount === 1 ? "account" : "accounts"}
                    </span>
                  ) : null}
                </td>
                <td className={styles.num}>{formatNumber(p.quantity, 4)}</td>
                <td className={styles.num}>{formatQuote(p.avgPurchasePrice, currency)}</td>
                <td
                  className={styles.num}
                  title={
                    p.quoteFetchedAt
                      ? `Fetched ${new Date(p.quoteFetchedAt).toLocaleString()}`
                      : undefined
                  }
                >
                  {p.marketPrice !== null ? formatQuote(p.marketPrice, currency) : "—"}
                  {p.priceOverridden ? (
                    <span className={styles.overridden} title="Concept price, set by hand">
                      set
                    </span>
                  ) : p.quoteStale ? (
                    <span className={styles.stale}>stale</span>
                  ) : null}
                </td>
                <td className={cn(styles.num, styles.strong, profitClass(p.profit))}>
                  {p.profit !== null ? formatSignedPrice(p.profit, currency) : "—"}
                </td>
                <td className={cn(styles.num, styles.strong, profitClass(p.profitPct))}>
                  {p.profitPct !== null ? formatPercent(p.profitPct, true) : "—"}
                </td>
                <td className={styles.num}>
                  {p.marketValue !== null ? formatPrice(p.marketValue, currency) : "—"}
                </td>
                <td className={styles.num}>
                  {p.marketValueEur !== null ? formatPrice(p.marketValueEur) : "—"}
                </td>
                <td className={styles.num}>
                  {p.portfolioPct !== null ? (
                    <>
                      {formatPercent(p.portfolioPct)}
                      <span className={styles.weightBar}>
                        <span
                          className={styles.weightFill}
                          style={{ width: `${Math.min(p.portfolioPct, 100)}%` }}
                        />
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={cn(styles.num, styles.strong, profitClass(p.dayChangePct))}>
                  {p.dayChangePct !== null ? formatPercent(p.dayChangePct, true) : "—"}
                </td>
                <td>
                  {p.sector ? (
                    <span className={styles.sector} title={p.sector}>
                      {p.sector}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {p.notes ? (
                    <span className={styles.notes} title={p.notes}>
                      {p.notes}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={styles.actionsCell}>
                  <ActionMenu
                    label={`Actions for ${p.ticker}`}
                    items={[
                      {
                        label: "Sell",
                        accent: true,
                        onSelect: () =>
                          onSell(p, p.accountCount === 1 ? p.lots[0].accountId : null),
                      },
                      { label: "Add lot", onSelect: () => onAddLot(p) },
                      ...(onSetPrice ? [{ label: "Set price", onSelect: () => onSetPrice(p) }] : []),
                      ...(onClearPrice && p.priceOverridden
                        ? [{ label: "Reset price", onSelect: () => onClearPrice(p) }]
                        : []),
                      ...(p.lots.length === 1
                        ? [{ label: "Edit", onSelect: () => onEditLot(p.lots[0]) }]
                        : []),
                      { label: "Delete", danger: true, onSelect: () => onDeleteStock(p) },
                    ]}
                  />
                </td>
              </tr>,
              ...(isOpen
                ? p.lots.map((lot) => (
                    <tr key={`lot-${lot.id}`} className={styles.lotRow}>
                      <td className={styles.lotCell}>
                        <span className={styles.lotAccount}>{lot.accountName}</span>
                        <span className={styles.lotDate}>
                          {lot.purchasedAt ? formatDate(lot.purchasedAt) : "no date"}
                        </span>
                      </td>
                      <td className={styles.num}>
                        {formatNumber(lot.quantity, 4)}
                        {lot.quantity !== lot.boughtQuantity ? (
                          <span className={styles.lotDate}>
                            of {formatNumber(lot.boughtQuantity, 4)} bought
                          </span>
                        ) : null}
                      </td>
                      <td className={styles.num}>{formatQuote(lot.purchasePrice, currency)}</td>
                      <td />
                      <td className={cn(styles.num, profitClass(lot.profit))}>
                        {lot.profit !== null ? formatSignedPrice(lot.profit, currency) : "—"}
                      </td>
                      <td className={cn(styles.num, profitClass(lot.profitPct))}>
                        {lot.profitPct !== null ? formatPercent(lot.profitPct, true) : "—"}
                      </td>
                      <td className={styles.num}>
                        {lot.marketValue !== null ? formatPrice(lot.marketValue, currency) : "—"}
                      </td>
                      <td className={styles.num}>
                        {lot.marketValueEur !== null ? formatPrice(lot.marketValueEur) : "—"}
                      </td>
                      <td colSpan={4} />
                      <td className={cn(styles.actionsCell, styles.lotActions)}>
                        <ActionMenu
                          label={`Actions for the ${lot.accountName} lot`}
                          items={[
                            { label: "Sell", accent: true, onSelect: () => onSell(p, lot.accountId) },
                            { label: "Edit", onSelect: () => onEditLot(lot) },
                            { label: "Delete", danger: true, onSelect: () => onDeleteLot(lot) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                : []),
              ...(isOpen && p.salesCount > 0
                ? [
                    <tr key={`realized-${p.ticker}`} className={styles.lotRow}>
                      <td className={styles.lotCell} colSpan={4}>
                        <span className={styles.lotAccount}>
                          Realized so far · {p.salesCount} {p.salesCount === 1 ? "sale" : "sales"}
                        </span>
                        <span className={styles.lotDate}>
                          {p.realizedPlEur !== null ? `${formatSignedPrice(p.realizedPlEur)} · ` : ""}
                          see History for details
                        </span>
                      </td>
                      <td className={cn(styles.num, styles.strong, profitClass(p.realizedPl))}>
                        {formatSignedPrice(p.realizedPl, currency)}
                      </td>
                      <td colSpan={7} />
                      <td className={cn(styles.actionsCell, styles.lotActions)} />
                    </tr>,
                  ]
                : []),
            ];
          })}
        </tbody>
        {hasTotals ? (
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className={cn(styles.num, profitClass(totals.profitEur))}>
                {formatSignedPrice(totals.profitEur)}
              </td>
              <td className={cn(styles.num, profitClass(totals.profitPct))}>
                {totals.profitPct !== null ? formatPercent(totals.profitPct, true) : "—"}
              </td>
              <td />
              <td className={styles.num}>{formatPrice(totals.stocksEur)}</td>
              <td className={styles.num}>{formatPercent(100)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
};

export default HoldingsTable;
