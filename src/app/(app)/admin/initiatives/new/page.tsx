import { TriangleAlert } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { FORM_COLUMN, PAGE_FRAME, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { InitiativeForm } from "@/components/initiative-form";
import { createInitiative } from "@/app/(app)/initiatives/actions";
import { cimKpiMap } from "@/lib/sources";
import { getActivePlan, getPlanAreas } from "@/lib/active-plan";

export const dynamic = "force-dynamic";

async function loadFormData() {
  const activePlan = await getActivePlan();
  const [initiatives, roster, risks, areas] = await Promise.all([
    prisma.initiative.findMany({ select: { code: true, teamLead: true } }),
    prisma.rosterMember.findMany({ select: { name: true, position: true } }),
    prisma.cimRisk.findMany({ orderBy: { code: "asc" }, select: { code: true, risk: true } }),
    getPlanAreas(activePlan?.id),
  ]);
  const usedCodes = initiatives.map((x) => x.code);
  // Owners are people from the People directory.
  const owners = [...new Set(roster.map((r) => r.name).filter(Boolean))].sort() as string[];
  const cimItems = risks.map((r) => ({ code: r.code, label: `${r.code} — ${r.risk}` }));
  const cimKpis = cimKpiMap();
  return { usedCodes, owners, cimItems, cimKpis, areas };
}

const ERRORS: Record<string, string> = {
  code: "A code is required (e.g. MRG-05).",
  duplicate: "That code is already in use. Pick a unique one.",
  problem: "A problem statement is required before saving.",
  area: "That area isn't part of the active plan. Pick one from the list.",
};

export default async function NewInitiativePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;
  const { usedCodes, owners, cimItems, cimKpis, areas } = await loadFormData();

  return (
    <div className={PAGE_FRAME}>
      <PageHeader sticky back={{ href: "/admin/initiatives", label: "Initiatives" }} eyebrow="Initiatives" title="New initiative" description="Priority is derived from the targeted value and effort. Only the driver, code, name and problem statement are required." />
      <div className={FORM_COLUMN}>

        {error && ERRORS[error] && error !== "problem" && (
          <Alert variant="risk" className="mb-4">
            <TriangleAlert size={16} aria-hidden />
            {ERRORS[error]}
          </Alert>
        )}

        <InitiativeForm action={createInitiative} submitLabel="Create initiative" cancelHref="/admin/initiatives" owners={owners} usedCodes={usedCodes} cimItems={cimItems} cimKpis={cimKpis} areas={areas} problemError={error === "problem"} />
      </div>
    </div>
  );
}
