import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { CimForm } from "@/components/cim-form";
import { updateCimRisk, deleteCimRisk } from "@/app/(app)/risks/actions";

export const dynamic = "force-dynamic";

export default async function EditCimRiskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conflict?: string }>;
}) {
  await requireEditor();
  const { id } = await params;
  const { conflict } = await searchParams;
  const risk = await prisma.cimRisk.findUnique({
    where: { id },
    include: { initiatives: { select: { initiativeId: true } } },
  });
  if (!risk) notFound();

  const [initiatives, roster] = await Promise.all([
    prisma.initiative.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.rosterMember.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const linkedIds = risk.initiatives.map((ri) => ri.initiativeId);
  const owners = [...new Set(roster.map((m) => m.name).filter(Boolean))] as string[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/risks" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> CIM Risks
      </Link>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Edit CIM risk</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            <span className="tabular text-ink-faint">{risk.code}</span> · changes are recorded in the audit log.
          </p>
        </div>
        <form action={deleteCimRisk}>
          <input type="hidden" name="id" value={risk.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-risk transition-colors hover:bg-risk-soft"
          >
            <Trash2 size={13} aria-hidden /> Delete
          </button>
        </form>
      </div>

      {conflict && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-sm text-ink">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <span>Someone else saved this risk while you were editing. The latest version is loaded below.</span>
        </div>
      )}

      <CimForm action={updateCimRisk} risk={risk} submitLabel="Save changes" initiatives={initiatives} linkedIds={linkedIds} owners={owners} />
    </div>
  );
}
