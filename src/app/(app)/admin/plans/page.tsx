import { Check } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { adminActivatePlan, adminSetPlanHeader } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan versions — Awayday" };

export default async function PlanVersionsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const plans = await prisma.planVersion.findMany({
    orderBy: [{ active: "desc" }, { code: "desc" }],
    select: { id: true, code: true, title: true, active: true, importedAt: true, sourceFileName: true, mission: true, goal: true, values: true, _count: { select: { initiatives: true } } },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Plan versions</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Choose which planning period the review, the timeline and the Initiatives list show, and set the mission, goal and values at the top of each plan&apos;s review. Historical records remain preserved when a plan is not active.
      </p>
      {error && <p className="mt-4 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">The plan could not be activated.</p>}

      <div className="mt-6 flex flex-col gap-3">
        {plans.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">
            No plan versions have been imported yet. Run the FY27 import after applying the database migration.
          </div>
        ) : plans.map((plan) => (
          <div key={plan.id} className={`rounded-xl border p-4 ${plan.active ? "border-ok/50 bg-ok-soft/30" : "border-border bg-surface"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">{plan.code}</h2>
                {plan.active && <Badge variant="ok" className="rounded px-1.5 text-micro font-semibold"><Check size={11} aria-hidden /> Active</Badge>}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{plan.title}</p>
              <p className="mt-1 text-note text-ink-faint">
                {plan._count.initiatives} initiatives · {plan.sourceFileName ?? "No source file"}
                {plan.importedAt ? ` · imported ${plan.importedAt.toLocaleDateString()}` : ""}
              </p>
            </div>
            {!plan.active && (
              <form action={adminActivatePlan}>
                <input type="hidden" name="planVersionId" value={plan.id} />
                <SubmitButton size="sm">Make active</SubmitButton>
              </form>
            )}
          </div>
          <details className="mt-3 border-t border-border/70 pt-3">
            <summary className="cursor-pointer text-xs font-medium text-ink-muted">
              Review header{plan.mission || plan.goal ? "" : " · not set"}
            </summary>
            <form action={adminSetPlanHeader} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="planVersionId" value={plan.id} />
              <Label className="flex flex-col gap-1.5">
                Mission
                <Input name="mission" defaultValue={plan.mission ?? ""} maxLength={300} size="sm" placeholder="What the company is here to do" />
              </Label>
              <Label className="flex flex-col gap-1.5">
                Goal
                <Input name="goal" defaultValue={plan.goal ?? ""} maxLength={300} size="sm" placeholder="EBITDA goal, budget, BHAG" />
              </Label>
              <Label className="flex flex-col gap-1.5">
                Values, one per line
                <Textarea name="values" defaultValue={plan.values.join("\n")} rows={4} size="sm" />
              </Label>
              <div>
                <SubmitButton size="sm" variant="outline">Save header</SubmitButton>
              </div>
            </form>
          </details>
          </div>
        ))}
      </div>
    </div>
  );
}
