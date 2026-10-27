import { BelowTheLineView, type BtlGroup } from "@/components/review/below-the-line-view";
import { NoDataNote, ReviewHeader } from "@/components/review/preview";
import { prisma } from "@/lib/prisma";
import { canEdit, requireApp } from "@/lib/session";
import { getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { BELOW_LINE_STATUSES, fmtDay, isoDay, shortCode, type BelowLineStatus } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function BelowTheLinePage() {
  const [session, { id }] = await Promise.all([requireApp("initiatives"), resolvePeriod()]);
  const plan = await getReviewPlan(id);
  const areaIds = plan.areas.map((a) => a.id).filter((x): x is string => Boolean(x));
  const projects = areaIds.length
    ? await prisma.belowLineProject.findMany({
        where: { strategicAreaId: { in: areaIds } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        include: { initiative: { select: { id: true, code: true, name: true } } },
      })
    : [];

  const groups: BtlGroup[] = plan.areas
    .filter((a) => a.id)
    .map((a) => ({
      areaId: a.id!,
      areaName: a.name,
      kindLabel: a.number ? `Pillar ${a.number}` : "Enabler",
      leads: a.ownerLine,
      sis: a.sis.map((s) => ({ id: s.id, shortCode: s.shortCode, name: s.name })),
      rows: projects
        .filter((p) => p.strategicAreaId === a.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          team: p.team,
          owner: p.owner,
          status: (BELOW_LINE_STATUSES.includes(p.status as BelowLineStatus) ? p.status : "NOT_STARTED") as BelowLineStatus,
          dueLabel: fmtDay(isoDay(p.dueAt)),
          si: p.initiative ? { id: p.initiative.id, shortCode: shortCode(p.initiative.code), name: p.initiative.name } : null,
        })),
    }));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <ReviewHeader
        eyebrow="Below the line"
        title="Below the line"
        description="The smaller projects teams run in each area that feed the strategic initiatives above the line, each with an owner, a status and the SI it feeds."
      />
      {groups.length > 0 ? (
        <BelowTheLineView groups={groups} canCreate={canEdit(session.user.role)} />
      ) : (
        <NoDataNote>{plan.title ?? "The active plan"} has no strategic areas, so below-the-line projects can&apos;t be filed against it.</NoDataNote>
      )}
    </div>
  );
}
