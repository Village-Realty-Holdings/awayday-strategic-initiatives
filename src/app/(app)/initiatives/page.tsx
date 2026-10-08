import { prisma } from "@/lib/prisma";
import { requireSession, canEdit } from "@/lib/session";
import { formatDateDay, pace } from "@/lib/initiatives";
import { InitiativesTable, type InitiativeRow } from "@/components/initiatives-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "Initiatives — Awayday" };

export default async function InitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const session = await requireSession();
  const editable = canEdit(session.user.role);
  const { group } = await searchParams;
  const [initiatives, groups] = await Promise.all([
    // Project only what the table needs (#34) — avoids pulling the large text
    // columns (problem / objective / deliverables) on every list load.
    prisma.initiative.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true, code: true, name: true, cimDriver: true, teamLead: true, supports: true,
        quadrant: true, value: true, lift: true, progressTarget: true, valueType: true,
        status: true, pctComplete: true, startDate: true, endDate: true,
        groups: { select: { id: true } },
      },
    }),
    prisma.initiativeGroup.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const now = new Date();
  const avg = initiatives.reduce((s, i) => s + i.pctComplete, 0) / Math.max(initiatives.length, 1);
  let behind = 0;

  const rows: InitiativeRow[] = initiatives.map((i) => {
    const p = pace(i.startDate, i.endDate, i.pctComplete, now);
    const isBehind = i.status !== "DONE" && p !== null && p.lag < -0.15;
    if (isBehind) behind++;
    return {
      id: i.id,
      code: i.code,
      name: i.name,
      cimDriver: i.cimDriver,
      teamLead: i.teamLead,
      supports: i.supports,
      quadrant: i.quadrant,
      value: i.value,
      lift: i.lift,
      valueTargeted: i.progressTarget,
      valueType: i.valueType,
      status: i.status,
      pct: i.pctComplete,
      endLabel: formatDateDay(i.endDate),
      endTime: i.endDate ? i.endDate.getTime() : null,
      groupIds: i.groups.map((g) => g.id),
      isBehind,
    };
  });

  const owners = [...new Set(initiatives.map((i) => i.teamLead).filter(Boolean))].sort() as string[];
  const cims = [...new Set(initiatives.map((i) => i.cimDriver).filter(Boolean))].sort() as string[];

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Strategic Initiatives</h1>
          <p className="mt-1 text-sm text-ink-muted">
            All active strategic work across Awayday, scored on value and effort.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="Initiatives" value={String(initiatives.length)} />
          <Stat label="Avg. complete" value={`${Math.round(avg * 100)}%`} />
          <Stat label="Behind pace" value={String(behind)} tone={behind > 0 ? "risk" : "ok"} />
        </div>
      </header>

      <InitiativesTable rows={rows} owners={owners} cims={cims} groups={groups} initialGroup={group ?? ""} editable={editable} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "risk" }) {
  return (
    <div className="text-right">
      <p
        className={`tabular text-lg font-semibold ${
          tone === "risk" ? "text-risk" : tone === "ok" ? "text-ok" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}
