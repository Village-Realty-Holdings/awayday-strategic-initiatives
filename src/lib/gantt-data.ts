import { prisma } from "@/lib/prisma";
import { activePlanInitiativeWhere } from "@/lib/active-plan";
import { siHealth } from "@/lib/initiatives";
import type { GanttRow } from "@/components/gantt-chart";

function quarterStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1));
}
function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

const DAY = 24 * 60 * 60 * 1000;

// Rows, quarter ticks and filters for <GanttChart />, scoped to the active plan.
// An initiative with no start/target date borrows its window from its
// milestones (earliest to latest due date, or the month before a lone one);
// those bars are flagged `derived`. Initiatives with neither come back in
// `unscheduled` so the chart can say what's missing instead of looking empty.
export async function loadGanttData() {
  const all = await prisma.initiative.findMany({
    where: await activePlanInitiativeWhere(),
    orderBy: [{ startDate: "asc" }, { code: "asc" }],
    include: { milestones: { where: { dueAt: { not: null } }, select: { dueAt: true } } },
  });

  const items: ((typeof all)[number] & { start: Date; end: Date; derived: boolean })[] = [];
  const unscheduled: { id: string; code: string; name: string; teamLead: string | null }[] = [];
  for (const i of all) {
    const due = i.milestones.map((m) => m.dueAt!.getTime()).sort((x, y) => x - y);
    const endT = i.endDate?.getTime() ?? (due.length ? due[due.length - 1] : null);
    let startT = i.startDate?.getTime() ?? (due.length ? due[0] : null);
    if (endT === null || startT === null) {
      unscheduled.push({ id: i.id, code: i.code, name: i.name, teamLead: i.teamLead });
      continue;
    }
    // A lone milestone (or a start on the target day) still gets a visible bar.
    if (startT >= endT) startT = endT - 30 * DAY;
    items.push({ ...i, start: new Date(startT), end: new Date(endT), derived: !i.startDate || !i.endDate });
  }
  items.sort((x, y) => x.start.getTime() - y.start.getTime() || x.code.localeCompare(y.code));

  // A plan with no dated initiatives would make Math.min/max return +/-Infinity (Invalid Date).
  const today = new Date().getTime();
  const minStart = new Date(items.length ? Math.min(...items.map((i) => i.start.getTime())) : today);
  const maxEnd = new Date(items.length ? Math.max(...items.map((i) => i.end.getTime())) : today);
  const domainStart = quarterStart(minStart);
  const domainEnd = addMonths(quarterStart(maxEnd), 3);
  const span = domainEnd.getTime() - domainStart.getTime();
  const pos = (d: Date) => ((d.getTime() - domainStart.getTime()) / span) * 100;

  // Axis ticks: quarters, or months when the whole range is two quarters or less.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const byMonth = span <= 190 * DAY;
  const quarters: { left: number; label: string }[] = [];
  for (let q = domainStart; q < domainEnd; q = addMonths(q, byMonth ? 1 : 3)) {
    const yy = String(q.getUTCFullYear()).slice(2);
    quarters.push({
      left: pos(q),
      label: byMonth ? `${MONTHS[q.getUTCMonth()]} '${yy}` : `Q${Math.floor(q.getUTCMonth() / 3) + 1} '${yy}`,
    });
  }

  const now = new Date();
  const todayPct = now >= domainStart && now <= domainEnd ? pos(now) : null;

  const rows: GanttRow[] = items.map((i) => {
    const left = pos(i.start);
    return {
      id: i.id,
      code: i.code,
      name: i.name,
      teamLead: i.teamLead,
      cimDriver: i.cimDriver,
      quadrant: i.quadrant,
      status: i.status,
      health: siHealth(i.status, i.pctComplete, i.start, i.end, now),
      leftPct: left,
      widthPct: Math.max(pos(i.end) - left, 1.2),
      pct: i.pctComplete,
      derived: i.derived,
    };
  });

  const owners = [...new Set(items.map((i) => i.teamLead).filter(Boolean))].sort() as string[];
  const cims = [...new Set(items.map((i) => i.cimDriver).filter(Boolean))].sort() as string[];

  return { rows, quarters, todayPct, owners, cims, unscheduled };
}
