import { prisma } from "@/lib/prisma";
import { siHealth } from "@/lib/initiatives";
import { GanttChart, type GanttRow } from "@/components/gantt-chart";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gantt — Awayday" };

function quarterStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1));
}
function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

export default async function GanttPage() {
  const all = await prisma.initiative.findMany({ orderBy: { startDate: "asc" } });
  // Type guard so startDate/endDate narrow to non-null and the `!` assertions drop away (#33).
  const items = all.filter(
    (i): i is (typeof all)[number] & { startDate: Date; endDate: Date } => i.startDate !== null && i.endDate !== null,
  );

  const minStart = new Date(Math.min(...items.map((i) => i.startDate.getTime())));
  const maxEnd = new Date(Math.max(...items.map((i) => i.endDate.getTime())));
  const domainStart = quarterStart(minStart);
  const domainEnd = addMonths(quarterStart(maxEnd), 3);
  const span = domainEnd.getTime() - domainStart.getTime();
  const pos = (d: Date) => ((d.getTime() - domainStart.getTime()) / span) * 100;

  const quarters: { left: number; label: string }[] = [];
  for (let q = domainStart; q < domainEnd; q = addMonths(q, 3)) {
    quarters.push({
      left: pos(q),
      label: `Q${Math.floor(q.getUTCMonth() / 3) + 1} '${String(q.getUTCFullYear()).slice(2)}`,
    });
  }

  const now = new Date();
  const todayPct = now >= domainStart && now <= domainEnd ? pos(now) : null;

  const rows: GanttRow[] = items.map((i) => {
    const left = pos(i.startDate);
    return {
      id: i.id,
      code: i.code,
      name: i.name,
      teamLead: i.teamLead,
      cimDriver: i.cimDriver,
      quadrant: i.quadrant,
      status: i.status,
      health: siHealth(i.status, i.pctComplete, i.startDate, i.endDate, now),
      leftPct: left,
      widthPct: Math.max(pos(i.endDate) - left, 1.2),
      pct: i.pctComplete,
    };
  });

  const owners = [...new Set(items.map((i) => i.teamLead).filter(Boolean))].sort() as string[];
  const cims = [...new Set(items.map((i) => i.cimDriver).filter(Boolean))].sort() as string[];

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Initiative Timeline</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Start-to-target windows with progress and a today marker. Filter by owner to see workload.
        </p>
      </header>
      <GanttChart rows={rows} quarters={quarters} todayPct={todayPct} owners={owners} cims={cims} />
    </div>
  );
}
