// SNAPSHOT of the Owner Scorecard table from src/app/(app)/scorecard/page.tsx
// before the shadcn Table migration, kept only for /dev/comparison.
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ScorecardRow, ScorecardTotals } from "@/components/scorecard-table";

function money(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

export function LegacyScorecardTable({ rows, totals: tot }: { rows: ScorecardRow[]; totals: ScorecardTotals }) {
  return (
  <div className="overflow-x-auto rounded-xl border border-border bg-surface">
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-[11px] font-medium text-ink-faint">
          <th className="px-4 py-2.5 font-medium">Owner</th>
          <Th>Initiatives</Th>
          <Th>Complete</Th>
          <Th>In flight</Th>
          <Th>Avg %</Th>
          <Th>Value to create</Th>
          <Th>Value created</Th>
          <Th>Value left</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.owner} className={`border-b border-border/60 last:border-0 ${r.count === 0 ? "opacity-60" : ""}`}>
            <td className="px-4 py-3">
              <div className="font-medium text-ink">
                <Link
                  href={`/scorecard/${encodeURIComponent(r.owner)}`}
                  className="rounded-sm underline-offset-2 hover:underline focus-visible:underline"
                >
                  {r.owner}
                </Link>
                {!r.inDirectory && (
                  <Badge variant="custom" className="ml-1.5 rounded bg-warn-soft px-1.5 text-[10px] text-warn" title="This owner is not in the People directory">
                    not in People
                  </Badge>
                )}
              </div>
              {(r.position || r.department) && (
                <div className="text-[11px] text-ink-faint">
                  {[r.position, r.department].filter(Boolean).join(" · ")}
                </div>
              )}
            </td>
            <Td>{r.count || "—"}</Td>
            <Td>{r.count ? r.complete : "—"}</Td>
            <Td>{r.count ? r.inFlight : "—"}</Td>
            <Td>{r.count ? `${Math.round(r.avgPct * 100)}%` : "—"}</Td>
            <Td>{r.toCreate ? money(r.toCreate) : "—"}</Td>
            <Td className="text-ok">{r.toCreate ? money(r.created) : "—"}</Td>
            <Td className="text-ink-muted">{r.toCreate ? money(r.toCreate - r.created) : "—"}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border bg-surface-2/40 text-ink">
          <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Total</td>
          <Td bold>{tot.count}</Td>
          <Td bold>{tot.complete}</Td>
          <Td bold>{tot.inFlight}</Td>
          <Td>—</Td>
          <Td bold>{tot.toCreate ? money(tot.toCreate) : "—"}</Td>
          <Td bold>{tot.toCreate ? money(tot.created) : "—"}</Td>
          <Td bold>{tot.toCreate ? money(tot.toCreate - tot.created) : "—"}</Td>
        </tr>
      </tfoot>
    </table>
  </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-right font-medium">{children}</th>;
}
function Td({ children, bold, className = "" }: { children: React.ReactNode; bold?: boolean; className?: string }) {
  return <td className={`tabular px-3 py-3 text-right ${bold ? "font-semibold text-ink" : "text-ink-muted"} ${className}`}>{children}</td>;
}
