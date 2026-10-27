import { MyUpdates, type MySiRow } from "@/components/review/my-updates";
import { PeriodSwitcherQuery } from "@/components/review/period-query";
import { NoDataNote, ReviewHeader } from "@/components/review/preview";
import { requireApp } from "@/lib/session";
import { allSis, getReviewPeriod, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { fmtDay, fmtLong, initiativeOwnerMatches, periodLabel, todayIso } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function MySisPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [session, { period: requested }] = await Promise.all([requireApp("initiatives"), searchParams]);
  // Opens on the newest month still taking updates (not yet published).
  const { id, periods, home, published } = await resolvePeriod(requested, "updates");
  const [plan, period] = await Promise.all([getReviewPlan(id), getReviewPeriod(id)]);
  const locked = published.includes(id);
  const today = todayIso();
  const mine = allSis(plan).filter((si) => initiativeOwnerMatches({ ownerUserId: si.ownerUserId, teamLead: si.lead }, session.user));

  const rows: MySiRow[] = mine.map((si) => ({
    id: si.id,
    shortCode: si.shortCode,
    name: si.name,
    areaName: si.areaName,
    updated: si.updatedThisPeriod,
    status: si.status,
    latestProgress: si.latestProgress ?? "",
    whatNext: si.whatNext ?? "",
    milestones: si.milestones
      .filter((m) => !m.done)
      .map((m) => ({ id: m.id, kind: "milestone" as const, text: m.title, dueLabel: fmtDay(m.date), done: false, pastDue: Boolean(m.date && m.date < today) })),
    actions: si.actions
      .filter((a) => !a.done)
      .map((a) => ({ id: a.id, kind: "action" as const, text: a.title, dueLabel: fmtDay(a.date), done: false, pastDue: Boolean(a.date && a.date < today) })),
  }));

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <ReviewHeader
        eyebrow="My SIs"
        title={`My SIs · ${periodLabel(id)}`}
        description="Your monthly update for each SI you lead: a status, latest progress and what next. It feeds the review and Asks by leader."
        actions={<PeriodSwitcherQuery periods={periods} current={id} home={home} basePath="/my" />}
      />
      {rows.length > 0 ? (
        <MyUpdates rows={rows} period={id} periodLabel={periodLabel(id)} locked={locked} dueLabel={period.updatesDueDate ? fmtLong(period.updatesDueDate) : null} />
      ) : (
        <NoDataNote>
          You don&apos;t lead any SI in {plan.title ?? "the active plan"}. SIs are matched to you by the lead named on the charter ({session.user.name}).
        </NoDataNote>
      )}
    </div>
  );
}
