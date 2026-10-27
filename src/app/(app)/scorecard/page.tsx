import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell/page-header";
import { requireSession } from "@/lib/session";
import { activePlanInitiativeWhere } from "@/lib/active-plan";
import { ScorecardTable, type ScorecardRow as Row } from "@/components/scorecard-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "Owner Scorecard — Awayday" };

export default async function ScorecardPage() {
  const [, where] = await Promise.all([requireSession(), activePlanInitiativeWhere()]);
  const [initiatives, people] = await Promise.all([
    prisma.initiative.findMany({
      where,
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
    <div className="mx-auto max-w-section">
      <PageHeader
        className="mb-6"
        eyebrow="Portfolio"
        title="Owner Scorecard"
        description={
          <>
            Everyone from the People directory, with their initiatives and value creation. Value
            to-create / created come from each charter&apos;s dollar goal and dollars done (set on the
            charter&apos;s Progress block).
          </>
        }
      />

      {!anyValue && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-sm text-ink">
          No dollar goals entered yet, so the value columns are empty. Add a value-to-create and value-created
          on any charter&apos;s Progress block and they will roll up here.
        </div>
      )}

      <ScorecardTable rows={rows} totals={tot} />
    </div>
  );
}
