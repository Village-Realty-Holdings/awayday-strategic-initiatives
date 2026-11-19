import { notFound, redirect } from "next/navigation";
import { ReviewView } from "@/components/review/review-view";
import { canEdit, requireApp } from "@/lib/session";
import { getActivePlan } from "@/lib/active-plan";
import { getFinanceTable, getReviewPeriod, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { getReviewedReport } from "@/lib/review-report-data";
import { todayIso } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function ReviewPeriodPage({ params }: { params: Promise<{ period: string }> }) {
  const [{ period: id }, session, { periods, home }] = await Promise.all([params, requireApp("initiatives"), resolvePeriod(), getActivePlan()]);
  if (!periods.includes(id)) notFound();
  if (id === home) redirect("/");
  const [plan, period, finance, report] = await Promise.all([getReviewPlan(id), getReviewPeriod(id), getFinanceTable(id), getReviewedReport(id)]);
  return <ReviewView plan={plan} period={period} periods={periods} home={home} finance={finance} report={report} today={todayIso()} canAuthor={session.user.role === "admin"} canEdit={canEdit(session.user.role)} />;
}
