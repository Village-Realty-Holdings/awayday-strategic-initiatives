import { canEdit, requireApp } from "@/lib/session";
import { ReviewView } from "../_components/review-view";
import { LATEST_PERIOD } from "../_mock/selectors";

export default async function ReviewLatestPage() {
  const session = await requireApp("initiatives");
  return <ReviewView period={LATEST_PERIOD} canEdit={canEdit(session.user.role)} />;
}
