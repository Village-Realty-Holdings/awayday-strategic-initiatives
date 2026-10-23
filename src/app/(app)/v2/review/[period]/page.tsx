import { notFound } from "next/navigation";
import { canEdit, requireApp } from "@/lib/session";
import { getActiveV2Plan } from "@/lib/v2-data";
import { ReviewView } from "../../_components/review-view";
import { getPeriod } from "../../_mock/selectors";

export default async function ReviewPeriodPage({ params }: { params: Promise<{ period: string }> }) {
  const session = await requireApp("initiatives");
  const { period: periodId } = await params;
  const period = getPeriod(periodId);
  if (!period) notFound();
  const livePlan = await getActiveV2Plan();
  return <ReviewView period={period} canEdit={canEdit(session.user.role)} livePlan={livePlan} />;
}
