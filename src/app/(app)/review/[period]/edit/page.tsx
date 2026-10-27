import { notFound } from "next/navigation";
import { createReviewPeriod } from "@/app/(app)/review-actions";
import { PeriodSwitcher } from "@/components/review/period-switcher";
import { PageHeader } from "@/components/shell/page-header";
import { ReviewEditor } from "@/components/review/review-editor";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/session";
import { allSis, getReviewPeriod, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { PERIOD_PATTERN } from "@/lib/review-model";

export const dynamic = "force-dynamic";

/**
 * Review authoring for Strategy (admins only): the month's header details, the
 * summary so-whats and one list per pillar or enabler, then publish. Any
 * YYYY-MM opens here; saving creates the month if it isn't stored yet.
 */
export default async function ReviewEditPage({ params }: { params: Promise<{ period: string }> }) {
  const [{ period: id }, session] = await Promise.all([params, requireAdmin()]);
  if (!PERIOD_PATTERN.test(id)) notFound();
  const [{ periods, home }, plan, period] = await Promise.all([resolvePeriod(), getReviewPlan(id), getReviewPeriod(id)]);
  const months = periods.includes(id) ? periods : [...periods, id].sort((a, b) => b.localeCompare(a));
  const sis = allSis(plan);

  return (
    <div className="mx-auto flex max-w-review flex-col gap-8">
      <PageHeader
        eyebrow="Review authoring"
        title={`Edit ${period.label} review`}
        description="Set the month's details, write the summary so-whats and the so-whats for each pillar and enabler, then publish."
        actions={
          <>
            <PeriodSwitcher periods={months} current={id} home={home} suffix="/edit" />
            <form action={createReviewPeriod} className="flex items-center gap-2">
              <Input name="period" type="month" required aria-label="Month to start" className="w-40" />
              <SubmitButton size="sm" variant="secondary">
                Start month
              </SubmitButton>
            </form>
          </>
        }
      />
      <ReviewEditor
        key={id}
        periodId={id}
        periodLabel={period.label}
        status={period.status}
        stored={period.stored}
        preparedBy={period.preparedBy ?? (period.stored ? "" : session.user.name)}
        meetingDate={period.meetingDate}
        updatesDueDate={period.updatesDueDate}
        dataAsOf={period.dataAsOfOverride}
        observedAsOf={period.observedAsOf}
        summary={period.summary}
        areas={plan.areas.map((a) => ({
          code: a.code,
          name: a.name,
          eyebrow: a.kind === "VALUE_DRIVER" ? `Pillar ${a.number}` : "Enabler",
          soWhats: period.areaSoWhats[a.code] ?? [],
        }))}
        updated={{ done: sis.filter((s) => s.updatedThisPeriod).length, total: sis.length }}
      />
    </div>
  );
}
