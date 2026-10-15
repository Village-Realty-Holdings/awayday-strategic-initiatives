import { notFound, redirect } from "next/navigation";
import { canEdit, requireApp } from "@/lib/session";
import { PeriodSwitcher } from "../../../_components/period-switcher";
import { V2Header } from "../../../_components/preview";
import { ReviewEditor } from "../../../_components/review-editor";
import { personName, SIS } from "../../../_mock/data";
import { areaName, getPeriod, pillarsFor, siShortCode, soWhatsFor, updateStateFor } from "../../../_mock/selectors";

export default async function ReviewEditPage({ params }: { params: Promise<{ period: string }> }) {
  const session = await requireApp("initiatives");
  const { period: periodId } = await params;
  const period = getPeriod(periodId);
  if (!period) notFound();
  // Authoring is editor/admin only, same as the other write surfaces.
  if (!canEdit(session.user.role)) redirect(`/v2/review/${period.id}`);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
      <V2Header
        eyebrow="Review authoring"
        title={`Edit ${period.label} review`}
        description="Write the summary so-whats and the so-whats under each pillar, set each pillar's status label and commentary, check who has submitted, then publish. Editing is a mock: nothing is saved."
        actions={<PeriodSwitcher current={period.id} suffix="/edit" />}
      />
      <ReviewEditor
        key={period.id}
        periodId={period.id}
        periodLabel={period.label}
        initialStatus={period.status}
        summarySoWhats={soWhatsFor(period.id, "SUMMARY").map((s) => ({ id: s.id, headline: s.headline, body: s.body }))}
        pillarSoWhats={Object.fromEntries(
          pillarsFor(period.id).map((p) => [
            p.areaCode,
            soWhatsFor(period.id, p.areaCode).map((s) => ({ id: s.id, headline: s.headline, body: s.body })),
          ]),
        )}
        pillars={pillarsFor(period.id).map((p) => ({
          areaCode: p.areaCode,
          name: areaName(p.areaCode),
          label: p.label,
          tone: p.tone,
          commentary: p.commentary,
        }))}
        sis={SIS.map((s) => ({
          code: s.code,
          shortCode: siShortCode(s.code),
          name: s.name,
          area: areaName(s.areaCode),
          owner: personName(s.ownerId),
          state: updateStateFor(s.code, period.id),
        }))}
      />
    </div>
  );
}
