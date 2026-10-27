import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { ConfirmAction } from "@/components/confirm-action";
import { FORM_COLUMN, PAGE_FRAME, PageHeader } from "@/components/shell/page-header";
import { Trash2, TriangleAlert } from "@/components/icons";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { CimForm } from "@/components/cim-form";
import { updateCimRisk, deleteCimRisk } from "@/app/(app)/risks/actions";
import { BreadcrumbTitle } from "@/components/shell/breadcrumbs";

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
    <div className={PAGE_FRAME}>
      <BreadcrumbTitle path={`/risks/${risk.id}`} title={risk.code} />
      <PageHeader sticky
        back={{ href: "/risks", label: "CIM Risks" }}
        eyebrow={<span className="tabular">{risk.code}</span>}
        title="Edit CIM risk"
        description="Changes are recorded in the audit log."
        actions={
          <ConfirmAction
            action={deleteCimRisk}
            fields={{ id: risk.id }}
            title="Delete CIM risk?"
            description={`Delete ${risk.code}? Linked initiatives are not affected. This can't be undone.`}
            confirmLabel="Delete risk"
            triggerProps={{ variant: "destructive", size: "sm", className: "px-2.5" }}
          >
            <Trash2 size={13} aria-hidden /> Delete
          </ConfirmAction>
        }
      />
      <div className={FORM_COLUMN}>

      {conflict && (
        <Alert variant="warn" className="mb-4">
          <TriangleAlert size={16} aria-hidden />
          <span>Someone else saved this risk while you were editing. The latest version is loaded below.</span>
        </Alert>
      )}

      <CimForm action={updateCimRisk} risk={risk} submitLabel="Save changes" initiatives={initiatives} linkedIds={linkedIds} owners={owners} />
      </div>
    </div>
  );
}
