import { prisma } from "@/lib/prisma";
import { requireApp, canEdit } from "@/lib/session";
import { pace } from "@/lib/initiatives";
import { getEbitdaBuild, getScorecardGoals, getPillars, getQ2Board } from "@/lib/overview-data";
import { EbitdaBuildSection } from "@/components/ebitda-build-section";
import { ScorecardSection } from "@/components/scorecard-section";
import { PillarsSection } from "@/components/pillars-section";
import { Q2BoardSection } from "@/components/q2board-section";
import { ScorecardTable, Q2Scorecard, type SiMap } from "@/components/overview-sections";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await requireApp("initiatives");
  const editable = canEdit(session.user.role);
  const [initiatives, risks, ebitda, goals, pillars, q2board] = await Promise.all([
    prisma.initiative.findMany({
      select: { id: true, code: true, name: true, pctComplete: true, status: true, quadrant: true, valueType: true, startDate: true, endDate: true },
    }),
    prisma.cimRisk.findMany({ include: { initiatives: { include: { initiative: true } } } }),
    getEbitdaBuild(),
    getScorecardGoals(),
    getPillars(),
    getQ2Board(),
  ]);
  const now = new Date();

  // code -> initiative, for SI-progress + deep links in the scorecard/pillars/Q2.
  const siMap: SiMap = {};
  for (const i of initiatives) siMap[i.code] = { id: i.id, pct: i.pctComplete, status: i.status };

  // Selectable options for the CIM / SI pickers in the inline editors.
  const siOptions = [...initiatives]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((i) => ({ code: i.code, label: i.name }));
  const cimOptions = [...risks]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((r) => ({ code: r.code, label: r.risk }));

  // KPIs (Portfolio at a glance)
  const count = (fn: (i: (typeof initiatives)[number]) => boolean) => initiatives.filter(fn).length;
  const inProgress = count((i) => i.status === "IN_PROGRESS");
  const quickWins = count((i) => i.valueType === "VALUE" && i.quadrant === "QUICK_WIN");
  const bigBets = count((i) => i.valueType === "VALUE" && i.quadrant === "BIG_BET");
  const completed = count((i) => i.status === "DONE");

  const behind = initiatives
    .map((i) => ({ i, p: pace(i.startDate, i.endDate, i.pctComplete, now) }))
    .filter((x): x is { i: (typeof initiatives)[number]; p: NonNullable<typeof x.p> } =>
      x.i.status !== "DONE" && x.p !== null && x.p.lag < -0.15)
    .sort((a, b) => a.p.lag - b.p.lag)
    .slice(0, 5);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Overview</h1>
        <p className="mt-1 text-sm text-ink-muted">Where Awayday stands on the path to the $150M EBITDA goal.</p>
      </div>

      {/* Portfolio at a glance */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4 lg:grid-cols-7">
        <Metric label="Initiatives" value={String(initiatives.length)} />
        <Metric label="In progress" value={String(inProgress)} />
        <Metric label="Quick wins" value={String(quickWins)} />
        <Metric label="Big bets" value={String(bigBets)} />
        <Metric label="Behind pace" value={String(behind.length)} tone={behind.length ? "risk" : "ok"} />
        <Metric label="Critical risks" value={String(risks.filter((r) => r.critical).length)} />
        <Metric label="Completed" value={String(completed)} />
      </section>

      {/* EBITDA — building a $150M business by 12/31/2027 */}
      <EbitdaBuildSection data={ebitda} editable={editable} />

      {/* 2026 Goals — the bright future */}
      <PillarsSection pillars={pillars} siMap={siMap} editable={editable} siOptions={siOptions} cimOptions={cimOptions} />

      {/* Financial & Operating Scorecard */}
      <ScorecardSection goals={goals} editable={editable} siOptions={siOptions} cimOptions={cimOptions}>
        <ScorecardTable goals={goals} siMap={siMap} />
      </ScorecardSection>

      {/* Q2 2026 Board Initiatives */}
      <Q2BoardSection items={q2board} editable={editable} siOptions={siOptions} cimOptions={cimOptions}>
        <Q2Scorecard items={q2board} siMap={siMap} />
      </Q2BoardSection>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "risk" }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className={`tabular text-xl font-semibold ${tone === "risk" ? "text-risk" : tone === "ok" ? "text-ok" : "text-ink"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}
