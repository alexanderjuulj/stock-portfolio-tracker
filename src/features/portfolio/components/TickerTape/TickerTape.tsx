import type { CSSProperties, FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import type { PortfolioPosition } from "@/types/api";
import styles from "./TickerTape.module.scss";

const MIN_ITEMS = 8;

type TickerTapeProps = {
  positions: PortfolioPosition[];
};

/**
 * Scrolling strip of every priced position with its day change, like the
 * tape on a trading floor. The track is rendered twice so the loop is
 * seamless; with reduced motion it sits still and scrolls by hand.
 */
const TickerTape: FC<TickerTapeProps> = ({ positions }): JSX.Element | null => {
  const priced = positions.filter((p) => p.marketPrice !== null);
  if (priced.length === 0) return null;

  // Each half of the track repeats the list until it holds at least MIN_ITEMS
  // entries, so a two-stock portfolio still fills the strip edge to edge.
  const repeats = Math.max(1, Math.ceil(MIN_ITEMS / priced.length));
  const items = Array.from({ length: repeats }, () => priced).flat().map((p, i) => {
    const change = p.dayChangePct;
    const tone = change === null ? styles.flat : change >= 0 ? styles.up : styles.down;
    return (
      <span key={`${p.ticker}-${i}`} className={styles.item}>
        <span className={styles.symbol}>{p.ticker}</span>
        <span className={styles.price}>{formatPrice(p.marketPrice ?? 0, p.currencyEffective)}</span>
        <span className={cn(styles.change, tone)}>
          {change === null ? "—" : `${change >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(change))}`}
        </span>
      </span>
    );
  });

  return (
    <div className={styles.tape} aria-label="Today's price change per position">
      <div className={styles.track} style={{ "--items": priced.length * repeats } as CSSProperties}>
        <div className={styles.run}>{items}</div>
        <div className={styles.run} aria-hidden="true">
          {items}
        </div>
      </div>
    </div>
  );
};

export default TickerTape;
