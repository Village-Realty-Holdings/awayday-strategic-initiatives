import { canEdit, requireApp } from "@/lib/session";
import { getActivePlan } from "@/lib/active-plan";
import { getActiveV2Plan } from "@/lib/v2-data";
import { ReviewView } from "../_components/review-view";
import { LATEST_PERIOD } from "../_mock/selectors";

export default async function ReviewLatestPage() {
  // Warm the per-request active-plan lookup alongside the auth check.
  const [session] = await Promise.all([requireApp("initiatives"), getActivePlan()]);
  const livePlan = await getActiveV2Plan();
  return <ReviewView period={LATEST_PERIOD} canEdit={canEdit(session.user.role)} livePlan={livePlan} />;
}
