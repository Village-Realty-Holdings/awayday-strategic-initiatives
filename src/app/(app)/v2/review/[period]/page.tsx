import { notFound } from "next/navigation";
import { canEdit, requireApp } from "@/lib/session";
import { ReviewView } from "../../_components/review-view";
import { getPeriod } from "../../_mock/selectors";

export default async function ReviewPeriodPage({ params }: { params: Promise<{ period: string }> }) {
  const session = await requireApp("initiatives");
  const { period: periodId } = await params;
  const period = getPeriod(periodId);
  if (!period) notFound();
  return <ReviewView period={period} canEdit={canEdit(session.user.role)} />;
}
