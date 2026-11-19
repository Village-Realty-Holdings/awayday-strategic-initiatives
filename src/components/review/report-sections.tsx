import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ExecCard, ReportTableRow } from "@/lib/review-report";
import type { ReportSection } from "@/lib/review-report-data";

// Presentation only: every number shown here was shaped from KpiObservation by
// review-report.ts. Missing values render "—" rather than a guess.

function Cell({ value, against }: { value: string | null; against?: number | null }) {
  if (value === null) return <span className="text-ink-faint">—</span>;
  return (
    <span
      className="tabular"
      title={against != null ? `comparison ${against.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : undefined}
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
        <table className="w-full min-w-[46rem] border-collapse text-xs">
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
                    <Cell value={entry.row.monthVsBudget.display} against={entry.row.monthVsBudget.against} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Cell value={entry.row.monthVsPriorYear.display} against={entry.row.monthVsPriorYear.against} />
                  </td>
                  <td className="border-l border-border px-3 py-1.5 text-right">
                    <Cell value={entry.row.ytdActual.display} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Cell value={entry.row.ytdVsBudget.display} against={entry.row.ytdVsBudget.against} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Cell value={entry.row.ytdVsPriorYear.display} against={entry.row.ytdVsPriorYear.against} />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-note text-ink-faint">
        “vs” columns are the difference between the reported actual and the reported comparison value; they are not separate observations. “—” means the
        value is not loaded for this population.
      </p>
    </div>
  );
}

/** The four headline cards the reviewed report opens with. */
export function ExecSummary({ cards, monthName }: { cards: ExecCard[]; monthName: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.id} className="gap-1 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <p className="text-note font-semibold uppercase tracking-eyebrow text-ink-faint">{card.title}</p>
            <Badge variant={card.metricName ? "secondary" : "outline"}>{card.scopeLabel}</Badge>
          </div>
          <p className="tabular text-2xl font-semibold tracking-tight text-ink">{card.value ?? "—"}</p>
          {card.value ? (
            <p className="text-xs text-ink-muted">
              {card.delta.display ? (
                <>
                  <span className="tabular">{card.delta.display}</span> {card.deltaLabel}
                </>
              ) : (
                card.deltaLabel
              )}
            </p>
          ) : (
            <p className="text-xs text-ink-muted">Not loaded. Expected identity: {card.expected}.</p>
          )}
          <p className="text-note text-ink-faint">
            {card.basisLabel}
            {card.metricName ? ` · ${card.metricName}` : ""} · {monthName}
          </p>
        </Card>
      ))}
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
