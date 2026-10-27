import { notFound } from "next/navigation";
import { TriangleAlert } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { FORM_COLUMN, PAGE_FRAME, PageHeader } from "@/components/shell/page-header";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { InitiativeForm } from "@/components/initiative-form";
import { updateInitiative } from "@/app/(app)/initiatives/actions";
import { cimKpiMap } from "@/lib/sources";
import { getActivePlan, getPlanAreas } from "@/lib/active-plan";
import { BreadcrumbTitle } from "@/components/shell/breadcrumbs";

export const dynamic = "force-dynamic";

export default async function EditInitiativePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conflict?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { conflict, error } = await searchParams;
  const initiative = await prisma.initiative.findUnique({ where: { id } });
  if (!initiative) notFound();

  // Areas of the initiative's own plan (or the active plan for a legacy one).
  const areaPlanId = initiative.planVersionId ?? (await getActivePlan())?.id;
  const [roster, risks, areas] = await Promise.all([
    prisma.rosterMember.findMany({ select: { name: true } }),
    prisma.cimRisk.findMany({ orderBy: { code: "asc" }, select: { code: true, risk: true } }),
    getPlanAreas(areaPlanId),
  ]);
  // Owners are people from the People directory.
  const owners = [...new Set(roster.map((r) => r.name).filter(Boolean))].sort() as string[];
  const cimItems = risks.map((r) => ({ code: r.code, label: `${r.code} — ${r.risk}` }));
  const cimKpis = cimKpiMap();

  return (
    <div className={PAGE_FRAME}>
      <BreadcrumbTitle path={`/initiatives/${initiative.id}`} title={`${initiative.code} ${initiative.name}`} />
      <PageHeader sticky
        back={{ href: `/initiatives/${id}`, label: "charter" }}
        eyebrow={<span className="tabular">{initiative.code}</span>}
        title="Edit initiative"
        description={<>{initiative.name}. Changes are recorded in the audit log.</>}
      />
      <div className={FORM_COLUMN}>

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
          problemError={error === "problem"}
        />
      </div>
    </div>
  );
}
