import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ExecCard, ReportTableRow } from "@/lib/review-report";
import type { ReportSection } from "@/lib/review-report-data";
import { deltaTone, resolveDirection, type StatusTone } from "@/lib/kpi-status";

// Presentation only: every number shown here was shaped from KpiObservation by
// review-report.ts. Missing values render "—" rather than a guess.

const TONE_CLASS: Record<StatusTone, string> = {
  good: "text-ok",
  warn: "text-warn",
  crit: "text-risk",
  neutral: "text-ink-muted",
};

function Cell({
  value,
  against,
  delta,
  directionSource,
  higherIsBetter,
}: {
  value: string | null;
  against?: number | null;
  delta?: number | null;
  /** The metric name a delta's direction is read from; omit for plain actuals. */
  directionSource?: string;
  /** Direction declared by an approved mapping; preferred over the name. */
  higherIsBetter?: boolean | null;
}) {
  if (value === null) return <span className="text-ink-faint">—</span>;
  // A delta is only coloured once its direction is known; a plain actual never
  // is. Nothing is inferred from the sign of a number alone.
  const tone =
    delta == null || (!directionSource && higherIsBetter == null)
      ? null
      : deltaTone(delta, resolveDirection(higherIsBetter, directionSource), against);
  return (
    <span
      className={`tabular ${tone ? TONE_CLASS[tone] : ""}`}
      title={against != null ? `compared with ${against.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : undefined}
      data-tone={tone ?? undefined}
    >
      {value}
    </span>
  );
}

const HEAD_LABELS = ["Actual", "vs budget", "vs prior year"] as const;

type Entry = { kind: "group"; id: string; label: string } | { kind: "row"; row: ReportTableRow };

/**
 * The reviewed report's comparison table: one actual plus two deltas for the
 * month, then the same for year to date. The deltas are arithmetic between two
 * reported values, not separate observations, and say so in the footnote.
 *
 * The first column is sticky (see `.report-table`), so a wide table scrolls
 * without losing the line being read, and every delta is coloured only when the
 * metric's direction is known.
 */
export function ComparisonTable({
  rows,
  monthName,
  groups,
  caption,
}: {
  rows?: ReportTableRow[];
  monthName: string;
  groups?: { id: string; label: string; rows: ReportTableRow[] }[];
  /** Screen-reader description of the table. */
  caption?: string;
}) {
  const entries: Entry[] = groups
    ? groups.flatMap((group) => [
        { kind: "group" as const, id: group.id, label: group.label },
        ...group.rows.map((row) => ({ kind: "row" as const, row })),
      ])
    : (rows ?? []).map((row) => ({ kind: "row" as const, row }));

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="report-table w-full min-w-[44rem] border-collapse text-xs">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border">
              <th rowSpan={2} scope="col" className="px-3 py-1.5 text-left align-bottom font-semibold text-ink">
                Line
              </th>
              <th colSpan={3} scope="colgroup" className="border-l border-border px-3 py-1.5 text-center font-semibold text-ink">
                {monthName}
              </th>
              <th colSpan={3} scope="colgroup" className="border-l border-border px-3 py-1.5 text-center font-semibold text-ink">
                Year to date
              </th>
            </tr>
            <tr className="border-b border-border text-ink-faint">
              {HEAD_LABELS.map((label, index) => (
                <th key={label} scope="col" className={`px-3 py-1.5 text-right font-medium ${index === 0 ? "border-l border-border" : ""}`}>
                  {label}
                </th>
              ))}
              {HEAD_LABELS.map((label, index) => (
                <th key={`ytd-${label}`} scope="col" className={`px-3 py-1.5 text-right font-medium ${index === 0 ? "border-l border-border" : ""}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              entry.kind === "group" ? (
                <tr key={`group-${entry.id}`} className="bg-surface-2">
                  <th scope="rowgroup" colSpan={7} className="px-3 py-1.5 text-left text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">
                    {entry.label}
                  </th>
                </tr>
              ) : (
                <tr key={entry.row.id} className={`border-t border-border/70 ${entry.row.emphasis ? "font-semibold text-ink" : "text-ink-muted"}`}>
                  <th scope="row" className="whitespace-normal px-3 py-1.5 text-left font-medium text-ink">
                    {entry.row.label}
                  </th>
                  <td className="px-3 py-1.5 text-right">
                    <Cell value={entry.row.monthActual.display} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Cell
                      value={entry.row.monthVsBudget.display}
                      against={entry.row.monthVsBudget.against}
                      delta={entry.row.monthVsBudget.value}
                      directionSource={entry.row.directionKey}
                      higherIsBetter={entry.row.higherIsBetter}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Cell
                      value={entry.row.monthVsPriorYear.display}
                      against={entry.row.monthVsPriorYear.against}
                      delta={entry.row.monthVsPriorYear.value}
                      directionSource={entry.row.directionKey}
                      higherIsBetter={entry.row.higherIsBetter}
                    />
                  </td>
                  <td className="border-l border-border px-3 py-1.5 text-right">
                    <Cell value={entry.row.ytdActual.display} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Cell
                      value={entry.row.ytdVsBudget.display}
                      against={entry.row.ytdVsBudget.against}
                      delta={entry.row.ytdVsBudget.value}
                      directionSource={entry.row.directionKey}
                      higherIsBetter={entry.row.higherIsBetter}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Cell
                      value={entry.row.ytdVsPriorYear.display}
                      against={entry.row.ytdVsPriorYear.against}
                      delta={entry.row.ytdVsPriorYear.value}
                      directionSource={entry.row.directionKey}
                      higherIsBetter={entry.row.higherIsBetter}
                    />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-note text-ink-faint">
        “vs” columns are the difference between the reported actual and the reported comparison value; they are not separate observations. “—” means the
        value is not loaded for this population. Green and red appear only where the metric&apos;s direction is known; otherwise the comparison stays neutral.
      </p>
    </div>
  );
}

/** The four headline cards the reviewed report opens with. */
export function ExecSummary({ cards, monthName }: { cards: ExecCard[]; monthName: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        // An approved mapping's declared direction wins over the card's name.
        const reading = resolveDirection(card.higherIsBetter, card.metricName ?? card.title);
        const tone = card.value ? deltaTone(card.delta.value, reading, card.delta.against) : null;
        return (
          <Card key={card.id} className="gap-1.5 p-4" data-exec-card={card.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <p className="text-note font-semibold uppercase tracking-eyebrow text-ink-faint">{card.title}</p>
              <Badge variant={card.metricName ? "secondary" : "outline"}>{card.scopeLabel}</Badge>
            </div>
            {card.value ? (
              <>
                <p className="tabular text-3xl font-semibold leading-none tracking-tight text-ink">{card.value}</p>
                {/* A loaded value with no comparison says so once, in the sentence
                    below that names what is missing; repeating the label here read
                    as two separate absences. */}
                {(card.delta.display || card.missingIdentities.length === 0) && (
                  <p className="text-xs leading-5 text-ink-muted">
                    {card.delta.display ? (
                      <>
                        <span className={`tabular font-medium ${tone ? TONE_CLASS[tone] : ""}`} data-tone={tone ?? undefined}>
                          {card.delta.display}
                        </span>{" "}
                        {card.deltaLabel}
                      </>
                    ) : (
                      card.deltaLabel
                    )}
                  </p>
                )}
                {/* The value is present; only its comparison is absent. Name the exact
                    identities needed rather than implying the figure failed to load. */}
                {card.missingIdentities.length > 0 && (
                  <p className="text-note leading-4 text-ink-faint" data-missing-comparison={card.id}>
                    Required to compare: {card.missingIdentities.join(" · ")}.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="tabular text-3xl font-semibold leading-none tracking-tight text-ink-faint">—</p>
                <p className="text-xs leading-5 text-ink-muted">No observation for this identity. Expected: {card.expected}.</p>
              </>
            )}
            <p className="text-note leading-4 text-ink-faint">
              {/* The basis and the review month, each stated once: an LTM card is
                  read "as at October", a monthly card is already the month. */}
              {card.basisLabel}
              {card.metricName ? ` · ${card.metricName}` : ""}
              {card.basisLabel === "Month" ? "" : card.basisLabel === "LTM" ? `, as at ${monthName}` : ` · ${monthName}`}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

/** One population's table: Base Business as a P&L, other populations as metric families. */
export function ReportSectionTable({ section, monthName }: { section: ReportSection; monthName: string }) {
  if (section.kind === "base-business") {
    return <ComparisonTable rows={section.rows} monthName={monthName} caption={`${section.scopeLabel} profit and loss`} />;
  }
  return <ComparisonTable groups={section.groups} monthName={monthName} caption={`${section.scopeLabel} operating metrics`} />;
}

/** A labelled frame for each population, so scope is never implied. */
export function PopulationCard({
  title,
  scopeLabel,
  description,
  children,
}: {
  title: string;
  scopeLabel: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="mt-4 gap-0 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <Badge variant="secondary">{scopeLabel}</Badge>
      </div>
      <p className="mb-3 text-note text-ink-faint">{description}</p>
      {children}
    </Card>
  );
}
