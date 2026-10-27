import { notFound, redirect } from "next/navigation";
import { ReviewView } from "@/components/review/review-view";
import { requireApp } from "@/lib/session";
import { getActivePlan } from "@/lib/active-plan";
import { getFinanceTable, getReviewPeriod, getReviewPeriodIds, getReviewPlan } from "@/lib/review-data";
import { todayIso } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function ReviewPeriodPage({ params }: { params: Promise<{ period: string }> }) {
  const [{ period: id }, , periods] = await Promise.all([params, requireApp("initiatives"), getReviewPeriodIds(), getActivePlan()]);
  if (!periods.includes(id)) notFound();
  if (id === periods[0]) redirect("/");
  const [plan, period, finance] = await Promise.all([getReviewPlan(id), getReviewPeriod(id), getFinanceTable(id)]);
  return <ReviewView plan={plan} period={period} periods={periods} finance={finance} today={todayIso()} />;
}
