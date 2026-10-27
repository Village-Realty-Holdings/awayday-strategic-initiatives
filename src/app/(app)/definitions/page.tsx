import { DefinitionsView } from "@/components/review/definitions-view";
import { PageHeader } from "@/components/shell/page-header";
import { prisma } from "@/lib/prisma";
import { requireApp } from "@/lib/session";
import { comparePeriods, PUBLICATION_APPROVED } from "@/lib/kpi";

export const dynamic = "force-dynamic";

export default async function DefinitionsPage() {
  await requireApp("initiatives");
  const defs = await prisma.kpiDefinition.findMany({
    orderBy: [{ strategicAreaId: "asc" }, { name: "asc" }],
    include: {
      strategicArea: { select: { name: true } },
      observations: { where: { publicationState: PUBLICATION_APPROVED }, select: { reportingPeriod: true }, distinct: ["reportingPeriod"] },
    },
  });
  const rows = defs.map((d) => ({
    id: d.id,
    name: d.name,
    metricKey: d.metricKey,
    unit: d.unit,
    target: d.target,
    sourceType: d.sourceType,
    area: d.strategicArea?.name ?? null,
    latestPeriod: d.observations.map((o) => o.reportingPeriod).sort((a, b) => comparePeriods(b, a))[0] ?? null,
  }));
  return (
    <div className="mx-auto flex max-w-review flex-col gap-6">
      <PageHeader
        eyebrow="Metric definitions"
        title="Metric definitions"
        description="Every metric the review can show, where its values come from, and the latest month that has data."
      />
      <DefinitionsView rows={rows} />
    </div>
  );
}
