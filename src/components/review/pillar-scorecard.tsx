import type { PillarScorecard, ScorecardRow } from "@/lib/review-report";
import { scorecardStatusLabel } from "@/lib/review-report";
import type { KpiStatus } from "@/lib/kpi-status";
import { KpiStatusBadge } from "./kpi-status-badge";

const STATUS: Record<ScorecardRow["status"], KpiStatus | null> = {
  ahead: "ahead",
  on_track: "on_track",
  behind: "behind",
  no_data: null,
};

function Status({ row }: { row: ScorecardRow }) {
  const status = STATUS[row.status];
  if (!status) return <span className="text-note text-ink-faint">{row.expectedOnly ? "Not loaded" : scorecardStatusLabel(row.status)}</span>;
  return <KpiStatusBadge status={status} />;
}

function DeltaCell({ row }: { row: ScorecardRow }) {
  if (row.expectedOnly) return <span className="text-ink-faint">—</span>;
  if (!row.delta.display) return <span className="text-note text-ink-faint">{row.deltaLabel}</span>;
  return (
    <span className="tabular" title={row.delta.against != null ? `${row.deltaLabel}: comparison ${row.delta.against.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : undefined}>
      {row.delta.display}
    </span>
  );
}

/**
 * A pillar's or enabler's detailed scorecard. Collapsed by default so the
 * review stays scannable; every line the reviewed report expects is listed,
 * including the ones with no definition or observation yet.
 */
export function PillarScorecardDetails({ scorecard, monthName }: { scorecard: PillarScorecard | undefined; monthName: string }) {
  if (!scorecard || scorecard.rows.length === 0) return null;
  const loaded = scorecard.rows.filter((row) => !row.expectedOnly).length;
  const summaryParts = [`${loaded} of ${scorecard.totalMetrics} metric${scorecard.totalMetrics === 1 ? "" : "s"} loaded`];
  if (scorecard.expectedMissing > 0) summaryParts.push(`${scorecard.expectedMissing} expected line${scorecard.expectedMissing === 1 ? "" : "s"} not loaded`);

  return (
    <details className="mt-4 rounded-lg border border-border bg-surface">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-ink marker:content-none">
        Detailed scorecard · {summaryParts.join(" · ")}
      </summary>
      <div className="border-t border-border/70 p-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-xs">
            <caption className="sr-only">Detailed scorecard</caption>
            <thead>
              <tr className="border-b border-border text-ink-faint">
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Measure</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">{monthName}</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Comparison</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Target</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.rows.map((row) => (
                <tr key={row.id} className={`border-t border-border/60 ${row.expectedOnly ? "text-ink-faint" : "text-ink-muted"}`}>
                  <th scope="row" className="whitespace-normal px-2 py-1.5 text-left font-medium text-ink">
                    {row.label}
                    {row.expectedOnly && <span className="ml-2 text-note font-normal text-ink-faint">expected, no definition linked</span>}
                  </th>
                  <td className="px-2 py-1.5 text-right">
                    {row.value ? (
                      <>
                        <span className="tabular">{row.value}</span>
                        {row.basisLabel && <span className="ml-1 text-note text-ink-faint">{row.basisLabel}</span>}
                        {scorecard.scopeLabels.length > 1 && row.scopeLabel && (
                          <span className="ml-1 block text-note text-ink-faint">{row.scopeLabel}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <DeltaCell row={row} />
                  </td>
                  <td className="px-2 py-1.5 text-left">{row.target || <span className="text-ink-faint">Not set</span>}</td>
                  <td className="px-2 py-1.5 text-left">
                    <Status row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-note text-ink-faint">
          {scorecard.scopeLabels.length > 0 ? `Populations in this scorecard: ${scorecard.scopeLabels.join(", ")}. ` : ""}
          Status compares the value with the definition&apos;s target; “Not loaded” means no observation exists for this month and population.
        </p>
      </div>
    </details>
  );
}
