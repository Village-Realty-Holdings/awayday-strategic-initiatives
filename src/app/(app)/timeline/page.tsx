import { PageHeader } from "@/components/shell/page-header";
import { TimelineExplorer } from "@/components/review/timeline-explorer";
import { GanttChart } from "@/components/gantt-chart";
import { loadGanttData } from "@/lib/gantt-data";
import { requireApp } from "@/lib/session";
import { allSis, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { todayIso } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const [, { id }] = await Promise.all([requireApp("initiatives"), resolvePeriod()]);
  const [plan, gantt] = await Promise.all([getReviewPlan(id), loadGanttData()]);
  const milestones = allSis(plan)
    .flatMap((s) => s.milestones)
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const owners = [...new Set(milestones.map((m) => m.owner).filter((o): o is string => Boolean(o)))].sort();
  return (
    <div className="mx-auto flex max-w-review flex-col gap-6">
      <section aria-label="Initiative timeline" className="grid gap-4">
        <PageHeader
          eyebrow="Timeline"
          title="Initiative Timeline"
          description="Start-to-target windows with progress and a today marker."
        />
        <GanttChart {...gantt} />
      </section>
      <PageHeader
        eyebrow=""
        title="Milestones"
        description="Every SI milestone in the active plan. Amber dates have passed and need a status."
      />
      <TimelineExplorer milestones={milestones} areas={plan.areas.map((a) => ({ value: a.code, label: a.name }))} owners={owners} today={todayIso()} />
    </div>
  );
}
