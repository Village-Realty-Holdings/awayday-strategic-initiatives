import { AsksByLeaderToggle } from "@/components/review/asks-by-leader";
import { ReviewHeader } from "@/components/review/preview";
import { requireApp } from "@/lib/session";
import { allSis, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { periodLabel, todayIso } from "@/lib/review-model";

export const dynamic = "force-dynamic";

export default async function AsksPage() {
  const [, { id }] = await Promise.all([requireApp("initiatives"), resolvePeriod()]);
  const plan = await getReviewPlan(id);
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <ReviewHeader
        eyebrow="Asks by leader"
        title={`Asks by leader · ${periodLabel(id)}`}
        description="The same two asks for every SI: latest progress, what next. Each leader's SIs show whether this month's update is in, plus anything still open."
      />
      <AsksByLeaderToggle sis={allSis(plan)} today={todayIso()} />
    </div>
  );
}
