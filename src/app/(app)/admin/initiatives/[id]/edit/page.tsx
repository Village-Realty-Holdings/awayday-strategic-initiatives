import { notFound } from "next/navigation";
import { TriangleAlert } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { PAGE_FRAME, PageHeader } from "@/components/shell/page-header";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { InitiativeForm } from "@/components/initiative-form";
import { updateInitiative } from "@/app/(app)/initiatives/actions";
import { getCimKpiMap } from "@/lib/strategy-reference-data";
import { getActivePlan, getPlanAreas } from "@/lib/active-plan";
import { BreadcrumbTitle } from "@/components/shell/breadcrumbs";

export const dynamic = "force-dynamic";

// A dependency's stored date, back in the charter's "30 Oct 2026" style.
const formatByWhen = (d: Date | null) =>
  d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

export default async function EditInitiativePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conflict?: string; error?: string }>;
}) {
  await requireEditor();
  const { id } = await params;
  const { conflict, error } = await searchParams;
  const initiative = await prisma.initiative.findUnique({
    where: { id },
    include: {
      riskLog: { orderBy: { order: "asc" } },
      actionItems: { where: { kind: "DEPENDENCY" }, orderBy: { order: "asc" } },
      milestones: { orderBy: [{ order: "asc" }, { dueAt: "asc" }] },
    },
  });
  if (!initiative) notFound();

  // Areas of the initiative's own plan (or the active plan for a legacy one).
  const areaPlanId = initiative.planVersionId ?? (await getActivePlan())?.id;
  const [roster, risks, areas, cimKpis] = await Promise.all([
    prisma.rosterMember.findMany({ select: { name: true } }),
    prisma.cimRisk.findMany({ orderBy: { code: "asc" }, select: { code: true, risk: true } }),
    getPlanAreas(areaPlanId),
    getCimKpiMap(),
  ]);
  // Owners are people from the People directory.
  const owners = [...new Set(roster.map((r) => r.name).filter(Boolean))].sort() as string[];
  const cimItems = risks.map((r) => ({ code: r.code, label: `${r.code} — ${r.risk}` }));
  const charter = {
    risks: initiative.riskLog.map((r) => ({ id: r.id, risk: r.risk, mitigation: r.mitigation ?? "", owner: r.owner ?? "" })),
    dependencies: initiative.actionItems.map((a) => ({ id: a.id, need: a.title, fromWhom: a.owner, byWhen: a.byWhen ?? formatByWhen(a.dueAt) })),
    milestones: initiative.milestones.map((m) => ({ id: m.id, title: m.title, owner: m.owner ?? "", dueAt: m.dueAt ? m.dueAt.toISOString().slice(0, 10) : "" })),
  };

  return (
    <div className={PAGE_FRAME}>
      <BreadcrumbTitle path={`/initiatives/${initiative.id}`} title={`${initiative.code} ${initiative.name}`} />
      <PageHeader sticky
        back={{ href: `/initiatives/${id}`, label: "charter" }}
        eyebrow={<span className="tabular">{initiative.code}</span>}
        title="Edit initiative"
        description={<>{initiative.name}. Changes are recorded in the audit log.</>}
      />
      <div className="w-full max-w-section">

        {conflict && (
          <Alert variant="warn" className="mb-4">
            <TriangleAlert size={16} aria-hidden />
            <span>
              Someone else saved this initiative while you were editing. The latest version is loaded
              below; review it and re-apply your changes.
            </span>
          </Alert>
        )}

        {error === "area" && (
          <Alert variant="risk" className="mb-4">
            <TriangleAlert size={16} aria-hidden />
            That area isn&apos;t part of this initiative&apos;s plan. Pick one from the list.
          </Alert>
        )}

        <InitiativeForm
          action={updateInitiative}
          initiative={initiative}
          submitLabel="Save changes"
          cancelHref={`/initiatives/${id}`}
          owners={owners}
          cimItems={cimItems}
          cimKpis={cimKpis}
          areas={areas}
          charter={charter}
        />
      </div>
    </div>
  );
}
