import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { InitiativeForm } from "@/components/initiative-form";
import { updateInitiative } from "@/app/(app)/initiatives/actions";
import { cimKpiMap } from "@/lib/sources";
import { getActivePlan, getPlanAreas } from "@/lib/active-plan";

export const dynamic = "force-dynamic";

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
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/initiatives/${id}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden /> Back to initiative
      </Link>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">Edit initiative</h1>
      <p className="mb-5 text-sm text-ink-muted">
        <span className="tabular text-ink-faint">{initiative.code}</span> · changes are recorded in the audit log.
      </p>

      {conflict && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-sm text-ink">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <span>
            Someone else saved this initiative while you were editing. The latest version is loaded
            below, review and re-apply your changes.
          </span>
        </div>
      )}

      {error === "area" && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">
          <TriangleAlert size={16} className="shrink-0 text-risk" aria-hidden />
          That area isn&apos;t part of this initiative&apos;s plan. Pick one from the list.
        </div>
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
  );
}
