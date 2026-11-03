import { BelowTheLineView, type BtlGroup } from "@/components/review/below-the-line-view";
import { NoDataNote } from "@/components/review/preview";
import { PageHeader } from "@/components/shell/page-header";
import { prisma } from "@/lib/prisma";
import { canEdit, requireApp } from "@/lib/session";
import { getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { BELOW_LINE_STATUSES, fmtDay, isoDay, shortCode, type BelowLineStatus } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function BelowTheLinePage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const [session, { id }, { area }] = await Promise.all([requireApp("initiatives"), resolvePeriod(), searchParams]);
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
      areaCode: a.code,
      areaName: a.name,
      isEnabler: a.kind === "ENABLER",
      kindLabel: a.number ? `Pillar ${a.number}` : "Enabler",
      leads: a.ownerLine,
      sis: a.sis.map((s) => ({
        id: s.id,
        shortCode: s.shortCode,
        name: s.name,
        goingFor: s.goingFor,
        lead: s.lead,
        status: s.status,
        dueLabel: fmtDay(s.milestones.filter((m) => !m.done && m.date).map((m) => m.date!).sort()[0] ?? null),
      })),
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
    <div className="mx-auto flex max-w-page flex-col gap-6">
      <PageHeader
        eyebrow="Below the line"
        title="Below the line"
        description="Pick a value creation pillar or enabler to see everything in it: its Awayday SIs and the below the line items teams run alongside them."
      />
      {groups.length > 0 ? (
        <BelowTheLineView groups={groups} initialArea={area ?? null} canCreate={canEdit(session.user.role)} />
      ) : (
        <NoDataNote>{plan.title ?? "The active plan"} has no strategic areas, so below-the-line projects can&apos;t be filed against it.</NoDataNote>
      )}
    </div>
  );
}
