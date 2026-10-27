import { StrategyReview } from "@/components/strategy-review";
import { requireApp } from "@/lib/session";
import { getActivePlan } from "@/lib/active-plan";
import { getStrategyReviewSnapshot } from "@/lib/strategy-review";

export const dynamic = "force-dynamic";

export default async function StrategyReviewPage() {
  // Warm the per-request active-plan lookup alongside the auth check.
  await Promise.all([requireApp("initiatives"), getActivePlan()]);

  return <StrategyReview snapshot={await getStrategyReviewSnapshot()} />;
}
