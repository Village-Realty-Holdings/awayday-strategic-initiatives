import { TriangleAlert } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { FORM_COLUMN, PAGE_FRAME, PageHeader } from "@/components/shell/page-header";
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
    <div className={PAGE_FRAME}>
      <PageHeader back={{ href: "/risks", label: "CIM Risks" }} eyebrow="CIM Risks" title="New CIM risk" />
      <div className={FORM_COLUMN}>
      {error && ERRORS[error] && (
        <Alert variant="risk" className="mb-4">
          <TriangleAlert size={16} aria-hidden />
          {ERRORS[error]}
        </Alert>
      )}
      <CimForm action={createCimRisk} submitLabel="Create risk" initiatives={initiatives} usedCodes={usedCodes} owners={owners} />
      </div>
    </div>
  );
}
