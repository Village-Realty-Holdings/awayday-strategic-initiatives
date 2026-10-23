import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, canEdit } from "@/lib/session";
import { activePlanInitiativeWhere } from "@/lib/active-plan";
import { formatDateDay, formatMoney, pace } from "@/lib/initiatives";
import { InitiativesTable, type InitiativeRow, NewInitiativeButton } from "@/components/initiatives-table";
import { PAGE_FRAME, PageHeader, Stat } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

// Everything one owner is responsible for, in one place (Alex 1-1 2026-08-19:
// the scorecard row alone wasn't useful — "you click into each one and then it
// shows you everything"). Owners are keyed by name (Initiative.teamLead is a
// string, not a relation), so the segment is the URL-encoded owner name;
// "Unassigned" collects initiatives with no team lead.
const UNASSIGNED = "Unassigned";

export async function generateMetadata({ params }: { params: Promise<{ owner: string }> }) {
  const { owner } = await params;
  return { title: `${decodeURIComponent(owner)} · Owner Scorecard — Awayday` };
}

export default async function OwnerPage({ params }: { params: Promise<{ owner: string }> }) {
  const session = await requireSession();
  const editable = canEdit(session.user.role);
  const owner = decodeURIComponent((await params).owner);

  const [initiatives, person] = await Promise.all([
    prisma.initiative.findMany({
      where: await activePlanInitiativeWhere(
        owner === UNASSIGNED ? { OR: [{ teamLead: null }, { teamLead: "" }] } : { teamLead: owner },
      ),
      orderBy: { code: "asc" },
      select: {
        id: true, code: true, name: true, cimDriver: true, teamLead: true, supports: true,
        quadrant: true, value: true, lift: true, progressTarget: true, progressActual: true,
        valueType: true, status: true, pctComplete: true, startDate: true, endDate: true,
        groups: { select: { id: true } },
      },
    }),
    owner === UNASSIGNED
      ? null
      : prisma.rosterMember.findFirst({ where: { name: owner }, select: { position: true, department: true } }),
  ]);

  // Unknown owner with no work: nothing to show.
  if (!person && initiatives.length === 0) notFound();

  const now = new Date();
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

  const complete = initiatives.filter((i) => i.status === "DONE" || i.pctComplete >= 0.999).length;
  const avg = initiatives.reduce((s, i) => s + i.pctComplete, 0) / Math.max(initiatives.length, 1);
  const toCreate = initiatives.reduce((s, i) => s + (i.progressTarget ?? 0), 0);
  const created = initiatives.reduce(
    (s, i) => s + (i.progressActual ?? ((i.progressTarget ?? 0) ? (i.progressTarget ?? 0) * i.pctComplete : 0)),
    0,
  );
  const cims = [...new Set(initiatives.map((i) => i.cimDriver).filter(Boolean))].sort() as string[];

  return (
    <div className={PAGE_FRAME}>
      <PageHeader
        back={{ href: "/scorecard", label: "Owner Scorecard" }}
        eyebrow="Owner Scorecard"
        title={owner}
        description={
          person && (person.position || person.department)
            ? [person.position, person.department].filter(Boolean).join(" · ")
            : owner === UNASSIGNED
              ? "Initiatives without a team lead. Assign an owner on each charter."
              : "Everything this owner is responsible for."
        }
        stats={
          <>
            <Stat label="Initiatives" value={String(initiatives.length)} />
            <Stat label="Complete" value={String(complete)} />
            <Stat label="Avg. complete" value={`${Math.round(avg * 100)}%`} />
            <Stat label="Behind pace" value={String(behind)} tone={behind > 0 ? "risk" : "ok"} />
            {toCreate > 0 && <Stat label="Value to create" value={formatMoney(toCreate)} />}
            {toCreate > 0 && <Stat label="Value created" value={formatMoney(created)} tone="ok" />}
          </>
        }
        actions={editable && <NewInitiativeButton />}
      />

      <InitiativesTable rows={rows} owners={owner === UNASSIGNED ? [] : [owner]} cims={cims} />
    </div>
  );
}

