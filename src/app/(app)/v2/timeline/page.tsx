import { requireApp } from "@/lib/session";
import { V2Header } from "../_components/preview";
import { TimelineExplorer, type TimelineItem } from "../_components/timeline-explorer";
import { AREAS, MOCK_TODAY } from "../_mock/data";
import { addDays, areaName, isPastDue, ownersWithMilestones, upcomingMilestones } from "../_mock/selectors";

export default async function TimelinePage() {
  await requireApp("initiatives");
  const end60 = addDays(MOCK_TODAY, 60);
  const items: TimelineItem[] = upcomingMilestones(null).map((m) => ({
    ...m,
    within60: m.date <= end60,
    pastDue: isPastDue(m),
  }));
  const pillars = AREAS.map((a) => ({ value: a.code, label: areaName(a.code) }));
  const owners = ownersWithMilestones()
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <V2Header
        eyebrow="Timeline"
        title="Next 60 days"
        description="Milestones the ELT should hold, across SIs and non-SI items (SI process, company-wide). Amber dates have passed and need a status."
      />
      <TimelineExplorer items={items} pillars={pillars} owners={owners} />
    </div>
  );
}
