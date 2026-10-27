import { prisma } from "@/lib/prisma";
import { getActivePlan, planInitiativeWhere } from "@/lib/active-plan";
import { requireSession, canEdit } from "@/lib/session";
import { formatDateDay, pace } from "@/lib/initiatives";
import { InitiativesTable, type InitiativeRow, NewInitiativeButton } from "@/components/initiatives-table";
import { PAGE_FRAME, PageHeader, Stat } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "Initiatives — Awayday" };

export default async function InitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  // The active plan doesn't depend on the session: look both up at once.
  const [session, { group }, activePlan] = await Promise.all([requireSession(), searchParams, getActivePlan()]);
  const editable = canEdit(session.user.role);
  const where = planInitiativeWhere(activePlan);
  const [initiatives, groups] = await Promise.all([
    // Project only what the table needs (#34) — avoids pulling the large text
    // columns (problem / objective / deliverables) on every list load.
    prisma.initiative.findMany({
      where,
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
    <div className={PAGE_FRAME}>
      <PageHeader
        title="Strategic Initiatives"
        description={<>{activePlan?.title ?? "All initiatives"}. Status updates and charter details are maintained here.</>}
        stats={
          <>
            <Stat label="Initiatives" value={String(initiatives.length)} />
            <Stat label="Avg. complete" value={`${Math.round(avg * 100)}%`} />
            <Stat label="Behind pace" value={String(behind)} tone={behind > 0 ? "risk" : "ok"} />
          </>
        }
        actions={editable && <NewInitiativeButton />}
      />

      <InitiativesTable rows={rows} owners={owners} cims={cims} groups={groups} initialGroup={group ?? ""} />
    </div>
  );
}

