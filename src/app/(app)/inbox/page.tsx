import { InboxView, type InboxAsk } from "@/components/review/inbox-view";
import { MyUpdates, type MyItem, type MySiRow } from "@/components/review/my-updates";
import { PeriodSwitcherQuery } from "@/components/review/period-query";
import { PageHeader } from "@/components/shell/page-header";
import { requireApp } from "@/lib/session";
import { allSis, getReviewPeriod, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { fmtDay, fmtLong, initiativeOwnerMatches, periodLabel, periodMonthName, todayIso } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [session, { period: requested }] = await Promise.all([requireApp("initiatives"), searchParams]);
  // Opens on the newest month still taking updates (not yet published).
  const { id, periods, home, published } = await resolvePeriod(requested, "updates");
  const [plan, period] = await Promise.all([getReviewPlan(id), getReviewPeriod(id)]);
  const locked = published.includes(id);
  const today = todayIso();
  const me = session.user;
  const sis = allSis(plan);
  const mine = sis.filter((si) => initiativeOwnerMatches({ ownerUserId: si.ownerUserId, teamLead: si.lead }, me));
  const myIds = new Set(mine.map((s) => s.id));
  const label = (si: { shortCode: string; name: string }) => `${si.shortCode} ${si.name}`;

  // Milestones and action items on my SIs, plus any elsewhere that name me as owner.
  const items: MyItem[] = sis.flatMap((si) => [
    ...si.milestones
      .filter((m) => !m.done && (myIds.has(si.id) || m.owner === me.name))
      .map((m) => ({ id: m.id, kind: "milestone" as const, text: `${m.title} (${label(si)})`, dueLabel: fmtDay(m.date), done: false, pastDue: Boolean(m.date && m.date < today) })),
    ...si.actions
      .filter((a) => !a.done && (myIds.has(si.id) || a.owner === me.name))
      .map((a) => ({ id: a.id, kind: "action" as const, text: `${a.title} (${label(si)})`, dueLabel: fmtDay(a.date), done: false, pastDue: Boolean(a.date && a.date < today) })),
  ]);
  items.sort((a, b) => Number(b.pastDue) - Number(a.pastDue));

  const asks: InboxAsk[] = mine.flatMap((si) =>
    si.asks.map((a) => ({ id: a.id, siId: si.id, siLabel: label(si), request: a.request, kind: a.kind, raisedLabel: fmtDay(a.raisedOn), open: a.status === "REQUESTED" })),
  );

  const rows: MySiRow[] = mine.map((si) => ({
    id: si.id,
    shortCode: si.shortCode,
    name: si.name,
    areaName: si.areaName,
    updated: si.updatedThisPeriod,
    status: si.status,
    latestProgress: si.latestProgress ?? "",
    whatNext: si.whatNext ?? "",
  }));

  return (
    <div className="mx-auto flex max-w-page flex-col gap-6">
      <PageHeader
        eyebrow="Inbox"
        title={`Inbox · ${me.name}`}
        description="Your monthly update for each SI you lead, the milestones and action items you own, and ELT asks on your SIs. Updates feed the review and Asks by leader. Ticking an item off saves it."
        actions={<PeriodSwitcherQuery periods={periods} current={id} home={home} basePath="/inbox" />}
      />
      <InboxView
        periodLabel={periodMonthName(id)}
        locked={locked}
        needUpdate={mine.filter((s) => !s.updatedThisPeriod).map((s) => ({ id: s.id, shortCode: s.shortCode, name: s.name }))}
        items={items}
        asks={asks}
      />
      {rows.length > 0 && (
        <MyUpdates rows={rows} period={id} periodLabel={periodLabel(id)} locked={locked} dueLabel={period.updatesDueDate ? fmtLong(period.updatesDueDate) : null} />
      )}
    </div>
  );
}
