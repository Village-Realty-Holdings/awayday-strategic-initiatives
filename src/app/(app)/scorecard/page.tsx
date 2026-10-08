import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Owner Scorecard — Awayday" };

function money(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

type Row = {
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

export default async function ScorecardPage() {
  await requireSession();
  const [initiatives, people] = await Promise.all([
    prisma.initiative.findMany({
      select: { teamLead: true, status: true, pctComplete: true, progressActual: true, progressTarget: true },
    }),
    prisma.rosterMember.findMany({
      select: { name: true, position: true, department: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Rows mirror the People directory: every person appears, even with zero initiatives.
  const map = new Map<string, Row>();
  const blank = (owner: string, position: string | null, department: string | null, inDirectory: boolean): Row => ({
    owner, position, department, inDirectory,
    count: 0, complete: 0, inFlight: 0, toCreate: 0, created: 0, avgPct: 0,
  });
  for (const p of people) map.set(p.name, blank(p.name, p.position, p.department, true));

  for (const i of initiatives) {
    const owner = i.teamLead || "Unassigned";
    let r = map.get(owner);
    // Owners not in the directory (legacy/unassigned) still show, flagged below.
    if (!r) { r = blank(owner, null, null, false); map.set(owner, r); }
    r.count++;
    const done = i.status === "DONE" || i.pctComplete >= 0.999;
    if (done) r.complete++;
    else r.inFlight++;
    // Value created = dollars done; to-create = dollar goal. Fall back to goal*pct when actual is unset.
    const target = i.progressTarget ?? 0;
    const actual = i.progressActual ?? (target ? target * i.pctComplete : 0);
    r.toCreate += target;
    r.created += actual;
    r.avgPct += i.pctComplete;
  }

  // Owners with work first (by value at stake, then count), then the rest of the directory A-Z.
  const rows = [...map.values()]
    .map((r) => ({ ...r, avgPct: r.count ? r.avgPct / r.count : 0 }))
    .sort((a, b) =>
      (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0) ||
      b.toCreate - a.toCreate ||
      b.count - a.count ||
      a.owner.localeCompare(b.owner),
    );

  const tot = rows.reduce(
    (a, r) => ({
      count: a.count + r.count, complete: a.complete + r.complete, inFlight: a.inFlight + r.inFlight,
      toCreate: a.toCreate + r.toCreate, created: a.created + r.created,
    }),
    { count: 0, complete: 0, inFlight: 0, toCreate: 0, created: 0 },
  );
  const anyValue = tot.toCreate > 0;

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Owner Scorecard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Everyone from the People directory, with their initiatives and value creation. Value
          to-create / created come from each charter&apos;s dollar goal and dollars done (set on the
          charter&apos;s Progress block).
        </p>
      </header>

      {!anyValue && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-sm text-ink">
          No dollar goals entered yet, so the value columns are empty. Add a value-to-create and value-created
          on any charter&apos;s Progress block and they will roll up here.
        </div>
      )}

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
                      <span className="ml-1.5 rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-warn" title="This owner is not in the People directory">
                        not in People
                      </span>
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
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-right font-medium">{children}</th>;
}
function Td({ children, bold, className = "" }: { children: React.ReactNode; bold?: boolean; className?: string }) {
  return <td className={`tabular px-3 py-3 text-right ${bold ? "font-semibold text-ink" : "text-ink-muted"} ${className}`}>{children}</td>;
}
