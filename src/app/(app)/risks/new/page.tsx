import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { requireEditor } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CimForm } from "@/components/cim-form";
import { createCimRisk } from "@/app/(app)/risks/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  code: "A code is required (e.g. CIM-17).",
  duplicate: "That code is already in use. Pick a unique one.",
};

export default async function NewCimRiskPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireEditor();
  const { error } = await searchParams;
  const [initiatives, risks, roster] = await Promise.all([
    prisma.initiative.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.cimRisk.findMany({ select: { code: true } }),
    prisma.rosterMember.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const usedCodes = risks.map((x) => x.code);
  const owners = [...new Set(roster.map((m) => m.name).filter(Boolean))] as string[];
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/risks" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> CIM Risks
      </Link>
      <h1 className="mb-5 text-xl font-semibold tracking-tight text-ink">New CIM risk</h1>
      {error && ERRORS[error] && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">
          <TriangleAlert size={16} className="shrink-0 text-risk" aria-hidden />
          {ERRORS[error]}
        </div>
      )}
      <CimForm action={createCimRisk} submitLabel="Create risk" initiatives={initiatives} usedCodes={usedCodes} owners={owners} />
    </div>
  );
}
