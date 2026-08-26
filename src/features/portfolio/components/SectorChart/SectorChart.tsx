import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import type { SectorAllocation } from "@/types/api";
import styles from "./SectorChart.module.scss";

type SectorChartProps = {
  sectors: SectorAllocation[];
  /** Total shown in the middle of the donut. */
  totalEur: number;
};

const SIZE = 200;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Slices are colored by rank, so the largest sectors always get the strongest greens.
const PALETTE = [
  "#1b7a4b",
  "#2f9e63",
  "#5cbf84",
  "#9ad9b4",
  "#c9a227",
  "#e0c36a",
  "#3f6f8f",
  "#7aa6c2",
  "#8d6e4b",
  "#c4a58a",
];

const SectorChart: FC<SectorChartProps> = ({ sectors, totalEur }): JSX.Element => {
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? sectors.find((s) => s.sector === active) ?? null : null;

  const slices = sectors.reduce<
    Array<SectorAllocation & { color: string; length: number; offset: number }>
  >((acc, s, i) => {
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.length : 0;
    acc.push({
      ...s,
      color: PALETTE[i % PALETTE.length],
      length: (s.pct / 100) * CIRCUMFERENCE,
      offset,
    });
    return acc;
  }, []);

  return (
    <div className={styles.chart}>
      <div className={styles.donutWrap}>
        <svg
          className={styles.donut}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Portfolio value by sector"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--background-color-secondary)"
            strokeWidth={STROKE}
          />
          {slices.map((s) => (
            <circle
              key={s.sector}
              className={cn(styles.slice, active && active !== s.sector && styles.sliceDim)}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${s.length} ${CIRCUMFERENCE - s.length}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              onMouseEnter={() => setActive(s.sector)}
              onMouseLeave={() => setActive(null)}
            >
              <title>
                {s.sector}: {formatPrice(s.valueEur)} ({formatPercent(s.pct)})
              </title>
            </circle>
          ))}
        </svg>
        <div className={styles.center}>
          <span className={styles.centerLabel}>{shown ? shown.sector : "Stocks"}</span>
          <span className={styles.centerValue}>
            {shown ? formatPercent(shown.pct) : formatPrice(totalEur)}
          </span>
        </div>
      </div>

      <ul className={styles.legend}>
        {slices.map((s) => (
          <li
            key={s.sector}
            className={cn(styles.legendItem, active && active !== s.sector && styles.legendDim)}
            onMouseEnter={() => setActive(s.sector)}
            onMouseLeave={() => setActive(null)}
            title={s.tickers.join(", ")}
          >
            <span className={styles.swatch} style={{ background: s.color }} />
            <span className={styles.legendName}>{s.sector}</span>
            <span className={styles.legendPct}>{formatPercent(s.pct)}</span>
            <span className={styles.legendValue}>{formatPrice(s.valueEur)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SectorChart;
