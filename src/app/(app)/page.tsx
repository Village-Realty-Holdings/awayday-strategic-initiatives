import { ReviewView } from "@/components/review/review-view";
import { requireApp } from "@/lib/session";
import { getActivePlan } from "@/lib/active-plan";
import { getFinanceTable, getReviewPeriod, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { todayIso } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function SummaryPage() {
  // Warm the per-request active-plan lookup alongside the auth check.
  const [, { id, periods }] = await Promise.all([requireApp("initiatives"), resolvePeriod(), getActivePlan()]);
  const [plan, period, finance] = await Promise.all([getReviewPlan(id), getReviewPeriod(id), getFinanceTable(id)]);
  return <ReviewView plan={plan} period={period} periods={periods} finance={finance} today={todayIso()} />;
}
