import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatValueForKind, type TrendChart, type TrendSeries } from "@/lib/review-report";

// A dependency-free SVG line chart. It is server-rendered: the accessible name,
// per-point <title> tooltips and the data table below the chart need no client
// JavaScript. Series are already chronological and restatement-aware.

const COLORS = ["var(--color-navy)", "var(--color-gold-deep)", "var(--color-ok)", "var(--color-risk)"];

const WIDTH = 720;
const HEIGHT = 240;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 60 };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" → "Oct 26". */
export function shortPeriod(period: string): string {
  const [year, month] = period.split("-");
  const name = MONTHS[Number(month) - 1];
  return name && year ? `${name} ${year.slice(2)}` : period;
}

function niceDomain(values: readonly number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  if (rawMin === rawMax) return { min: rawMin - 1, max: rawMax + 1 };
  const padding = (rawMax - rawMin) * 0.08;
  return { min: rawMin < 0 ? rawMin - padding : 0, max: rawMax + padding };
}

function ticks(min: number, max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => min + ((max - min) * index) / count);
}

/** The basis shown for a drawn series, from the chart's own resolution. */
function basisFor(chart: TrendChart, series: TrendSeries): string | null {
  const match = chart.basisLabels.find((label) => label.startsWith(`${series.label}: `));
  return match ? match.slice(series.label.length + 2) : null;
}

function SeriesLine({
  series,
  periods,
  x,
  y,
  color,
}: {
  series: TrendSeries;
  /** The shared month axis, so a missing month breaks the line instead of being drawn through. */
  periods: readonly string[];
  x: (period: string) => number;
  y: (value: number) => number;
  color: string;
}) {
  const points = series.points.map((point) => ({ ...point, cx: x(point.period), cy: y(point.value) }));
  // Consecutive months on the axis share a segment; a gap starts a new one, so the
  // chart never implies an interpolated value that was not observed.
  const segments: (typeof points)[] = [];
  for (const point of points) {
    const current = segments[segments.length - 1];
    const previous = current?.[current.length - 1];
    if (!previous || periods.indexOf(point.period) !== periods.indexOf(previous.period) + 1) segments.push([point]);
    else current.push(point);
  }
  return (
    <g>
      {segments.map((segment) => (
        <path
          key={segment[0].period}
          d={segment.map((point, index) => `${index === 0 ? "M" : "L"}${point.cx.toFixed(1)},${point.cy.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={series.style === "dashed" ? "6 4" : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {points.map((point) => (
        <circle
          key={point.period}
          cx={point.cx}
          cy={point.cy}
          r={point.restated ? 4.5 : 3}
          fill={point.restated ? "var(--color-surface)" : color}
          stroke={color}
          strokeWidth={point.restated ? 2 : 1}
        >
          <title>{`${series.label} · ${shortPeriod(point.period)} · ${formatValueForKind(series.kind, point.value)}${point.restated ? " (restated)" : ""}`}</title>
        </circle>
      ))}
    </g>
  );
}

export function TrendChartCard({ chart, className }: { chart: TrendChart; className?: string }) {
  const withPoints = chart.series.filter((series) => series.points.length > 0);
  if (withPoints.length === 0) {
    return (
      <Card className={`gap-2 p-5 ${className ?? ""}`}>
        <h3 className="text-base font-semibold text-ink">{chart.title}</h3>
        <p className="text-note text-ink-faint">{chart.description}</p>
        <ul className="flex flex-col gap-2">
          {chart.notes.map((note) => (
            <li key={note} className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-ink-muted">
              {note}
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  // The contiguous axis comes from the shaping module: rebuilding it from the
  // observed points would close every gap and draw a line through missing months.
  const periods = chart.periods;
  const { min, max } = niceDomain(withPoints.flatMap((series) => series.points.map((point) => point.value)));
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (period: string) => {
    if (periods.length === 1) return MARGIN.left + plotWidth / 2;
    return MARGIN.left + (periods.indexOf(period) / (periods.length - 1)) * plotWidth;
  };
  const y = (value: number) => MARGIN.top + ((max - value) / (max - min)) * plotHeight;
  const tickValues = ticks(min, max);
  const kind = withPoints[0].kind;
  const labelledEvery = periods.length > 12 ? 2 : 1;

  return (
    <Card className={`gap-3 p-5 ${className ?? ""}`}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">{chart.title}</h3>
          <Badge variant="secondary">{withPoints.map((series) => series.scopeLabel).filter((label, index, all) => all.indexOf(label) === index).join(" · ")}</Badge>
        </div>
        <p className="mt-1 text-note text-ink-faint">{chart.description}</p>
      </div>

      <ul className="flex flex-wrap gap-3 text-note text-ink-muted">
        {withPoints.map((series, index) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span>{series.label}</span>
            <span className="text-ink-faint">· {series.scopeLabel}</span>
            {basisFor(chart, series) && <span className="text-ink-faint">· {basisFor(chart, series)} basis</span>}
            {series.points.length < 2 && <span className="text-warn">· {series.points.length} month loaded</span>}
          </li>
        ))}
      </ul>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${chart.title}. ${withPoints.map((series) => `${series.label}: ${series.points.length} months`).join(". ")}.`}
        className="h-auto w-full"
      >
        {tickValues.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={MARGIN.left - 8} y={y(tick) + 3} textAnchor="end" fill="var(--color-ink-faint)" fontSize={10}>
              {formatValueForKind(kind, tick)}
            </text>
          </g>
        ))}
        {periods.map((period, index) =>
          index % labelledEvery === 0 ? (
            <text key={period} x={x(period)} y={HEIGHT - 8} textAnchor="middle" fill="var(--color-ink-faint)" fontSize={10}>
              {shortPeriod(period)}
            </text>
          ) : null,
        )}
        {withPoints.map((series, index) => (
          <SeriesLine key={series.key} series={series} periods={periods} x={x} y={y} color={COLORS[index % COLORS.length]} />
        ))}
      </svg>

      {chart.notes.map((note) => (
        <p key={note} className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-ink-muted">
          {note}
        </p>
      ))}

      <details className="text-xs text-ink-muted">
        <summary className="cursor-pointer text-note font-semibold text-ink">Show the numbers</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-xs">
            <caption className="sr-only">{chart.title} values by month</caption>
            <thead>
              <tr className="border-b border-border text-ink-faint">
                <th scope="col" className="px-2 py-1 text-left font-medium">Month</th>
                {withPoints.map((series) => (
                  <th key={series.key} scope="col" className="px-2 py-1 text-right font-medium">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period} className="border-t border-border/60">
                  <th scope="row" className="px-2 py-1 text-left font-medium text-ink">{shortPeriod(period)}</th>
                  {withPoints.map((series) => {
                    const point = series.points.find((candidate) => candidate.period === period);
                    return (
                      <td key={series.key} className="tabular px-2 py-1 text-right">
                        {point ? `${formatValueForKind(series.kind, point.value)}${point.restated ? "*" : ""}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-note text-ink-faint">
          * restated value (the observation has more than one revision). A line breaks where a month has no observation, so no value is interpolated
          across a gap.
        </p>
      </details>
    </Card>
  );
}
