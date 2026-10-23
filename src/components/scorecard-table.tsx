import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ScorecardRow = {
  owner: string;
  position: string | null;
  department: string | null;
  inDirectory: boolean;
  count: number;
  complete: number;
  inFlight: number;
  toCreate: number;
  created: number;
  avgPct: number;
};

export type ScorecardTotals = { count: number; complete: number; inFlight: number; toCreate: number; created: number };

function money(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

const NUM = "tabular whitespace-nowrap text-right";

// Owner Scorecard table (presentational; the page computes rows and totals).
export function ScorecardTable({ rows, totals: tot }: { rows: ScorecardRow[]; totals: ScorecardTotals }) {
  return (
    <Table stickyHeader containerClassName="rounded-xl border border-border bg-surface" className="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Owner</TableHead>
          <TableHead className="text-right">Initiatives</TableHead>
          <TableHead className="text-right">Complete</TableHead>
          <TableHead className="text-right">In flight</TableHead>
          <TableHead className="text-right">Avg %</TableHead>
          <TableHead className="text-right">Value to create</TableHead>
          <TableHead className="text-right">Value created</TableHead>
          <TableHead className="text-right">Value left</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <TableEmpty colSpan={8}>No people in the directory yet.</TableEmpty>}
        {rows.map((r) => {
          const idle = r.count === 0;
          return (
            <TableRow key={r.owner} className={cn(idle && "text-ink-faint")}>
              <TableCell className="py-3 pl-4">
                <div className={cn("font-medium", idle ? "text-ink-muted" : "text-ink")}>
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
                  <div className="text-[11px] text-ink-faint">{[r.position, r.department].filter(Boolean).join(" · ")}</div>
                )}
              </TableCell>
              <TableCell className={cn(NUM, !idle && "text-ink-muted")}>{r.count || "—"}</TableCell>
              <TableCell className={cn(NUM, !idle && "text-ink-muted")}>{r.count ? r.complete : "—"}</TableCell>
              <TableCell className={cn(NUM, !idle && "text-ink-muted")}>{r.count ? r.inFlight : "—"}</TableCell>
              <TableCell className={cn(NUM, !idle && "text-ink-muted")}>
                {r.count ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-surface-2 sm:block" aria-hidden>
                      <span className="block h-full rounded-full bg-navy" style={{ width: `${Math.round(r.avgPct * 100)}%` }} />
                    </span>
                    {Math.round(r.avgPct * 100)}%
                  </span>
                ) : "—"}
              </TableCell>
              <TableCell className={cn(NUM, !idle && "text-ink-muted")}>{r.toCreate ? money(r.toCreate) : "—"}</TableCell>
              <TableCell className={cn(NUM, r.toCreate && "text-ok")}>{r.toCreate ? money(r.created) : "—"}</TableCell>
              <TableCell className={cn(NUM, !idle && "text-ink-muted")}>{r.toCreate ? money(r.toCreate - r.created) : "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="py-3 pl-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">Total</TableCell>
          <TableCell className={cn(NUM, "font-semibold")}>{tot.count}</TableCell>
          <TableCell className={cn(NUM, "font-semibold")}>{tot.complete}</TableCell>
          <TableCell className={cn(NUM, "font-semibold")}>{tot.inFlight}</TableCell>
          <TableCell className={cn(NUM, "text-ink-muted")}>—</TableCell>
          <TableCell className={cn(NUM, "font-semibold")}>{tot.toCreate ? money(tot.toCreate) : "—"}</TableCell>
          <TableCell className={cn(NUM, "font-semibold")}>{tot.toCreate ? money(tot.created) : "—"}</TableCell>
          <TableCell className={cn(NUM, "font-semibold")}>{tot.toCreate ? money(tot.toCreate - tot.created) : "—"}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
