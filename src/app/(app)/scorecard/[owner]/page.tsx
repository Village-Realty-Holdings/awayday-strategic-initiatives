import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, canEdit } from "@/lib/session";
import { formatDateDay, formatMoney, pace } from "@/lib/initiatives";
import { InitiativesTable, type InitiativeRow } from "@/components/initiatives-table";

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
      where: owner === UNASSIGNED ? { OR: [{ teamLead: null }, { teamLead: "" }] } : { teamLead: owner },
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
    <div className="mx-auto max-w-[1400px]">
      <Link href="/scorecard" className="mb-4 inline-block text-xs font-medium text-ink-faint hover:text-ink">
        ← Owner Scorecard
      </Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{owner}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {person && (person.position || person.department)
              ? [person.position, person.department].filter(Boolean).join(" · ")
              : owner === UNASSIGNED
                ? "Initiatives without a team lead. Assign an owner on each charter."
                : "Everything this owner is responsible for."}
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="Initiatives" value={String(initiatives.length)} />
          <Stat label="Complete" value={String(complete)} />
          <Stat label="Avg. complete" value={`${Math.round(avg * 100)}%`} />
          <Stat label="Behind pace" value={String(behind)} tone={behind > 0 ? "risk" : "ok"} />
          {toCreate > 0 && <Stat label="Value to create" value={formatMoney(toCreate)} />}
          {toCreate > 0 && <Stat label="Value created" value={formatMoney(created)} tone="ok" />}
        </div>
      </header>

      <InitiativesTable rows={rows} owners={owner === UNASSIGNED ? [] : [owner]} cims={cims} editable={editable} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "risk" }) {
  return (
    <div className="text-right">
      <p className={`tabular text-lg font-semibold ${tone === "risk" ? "text-risk" : tone === "ok" ? "text-ok" : "text-ink"}`}>
        {value}
      </p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}
