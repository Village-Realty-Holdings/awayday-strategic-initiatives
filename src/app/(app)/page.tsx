import { StrategyReview } from "@/components/strategy-review";
import { requireApp } from "@/lib/session";
import { getStrategyReviewSnapshot } from "@/lib/strategy-review";

export const dynamic = "force-dynamic";

export default async function StrategyReviewPage() {
  await requireApp("initiatives");

  return <StrategyReview snapshot={await getStrategyReviewSnapshot()} />;
}
