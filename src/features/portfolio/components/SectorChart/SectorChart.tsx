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
// Slices are colored by rank; neighbours alternate hue families so adjacent slices stay distinct.
const PALETTE = [
  "#3fdc9a",
  "#f2b53f",
  "#5aa9ff",
  "#9b8cff",
  "#178a5c",
  "#c98b22",
  "#2f6fc4",
  "#ff8fa3",
  "#6f7f90",
  "#3d4a58",
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
            stroke="var(--clr-paper-2)"
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
