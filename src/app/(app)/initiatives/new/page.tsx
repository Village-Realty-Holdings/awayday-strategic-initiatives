import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { requireEditor } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { InitiativeForm } from "@/components/initiative-form";
import { createInitiative } from "@/app/(app)/initiatives/actions";
import { cimKpiMap } from "@/lib/sources";

export const dynamic = "force-dynamic";

async function loadFormData() {
  const [initiatives, roster, risks] = await Promise.all([
    prisma.initiative.findMany({ select: { code: true, teamLead: true } }),
    prisma.rosterMember.findMany({ select: { name: true, position: true } }),
    prisma.cimRisk.findMany({ orderBy: { code: "asc" }, select: { code: true, risk: true } }),
  ]);
  const usedCodes = initiatives.map((x) => x.code);
  // Owners are people from the People directory.
  const owners = [...new Set(roster.map((r) => r.name).filter(Boolean))].sort() as string[];
  const cimItems = risks.map((r) => ({ code: r.code, label: `${r.code} — ${r.risk}` }));
  const cimKpis = cimKpiMap();
  return { usedCodes, owners, cimItems, cimKpis };
}

const ERRORS: Record<string, string> = {
  code: "A code is required (e.g. MRG-05).",
  duplicate: "That code is already in use. Pick a unique one.",
  problem: "A problem statement is required before saving.",
};

export default async function NewInitiativePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireEditor();
  const { error } = await searchParams;
  const { usedCodes, owners, cimItems, cimKpis } = await loadFormData();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/initiatives"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden /> All initiatives
      </Link>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">New initiative</h1>
      <p className="mb-5 text-sm text-ink-muted">Priority is derived from the targeted value and effort.</p>

      {error && ERRORS[error] && error !== "problem" && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">
          <TriangleAlert size={16} className="shrink-0 text-risk" aria-hidden />
          {ERRORS[error]}
        </div>
      )}

      <InitiativeForm action={createInitiative} submitLabel="Create initiative" cancelHref="/initiatives" owners={owners} usedCodes={usedCodes} cimItems={cimItems} cimKpis={cimKpis} problemError={error === "problem"} />
    </div>
  );
}
