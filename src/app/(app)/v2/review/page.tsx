import { canEdit, requireApp } from "@/lib/session";
import { getActiveV2Plan } from "@/lib/v2-data";
import { ReviewView } from "../_components/review-view";
import { LATEST_PERIOD } from "../_mock/selectors";

export default async function ReviewLatestPage() {
  const session = await requireApp("initiatives");
  const livePlan = await getActiveV2Plan();
  return <ReviewView period={LATEST_PERIOD} canEdit={canEdit(session.user.role)} livePlan={livePlan} />;
}
