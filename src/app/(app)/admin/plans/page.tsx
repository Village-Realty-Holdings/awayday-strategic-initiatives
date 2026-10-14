import Link from "next/link";
import { Check, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { adminActivatePlan } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan versions — Awayday" };

export default async function PlanVersionsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireSession({ role: "admin" });
  const { saved, error } = await searchParams;
  const plans = await prisma.planVersion.findMany({
    orderBy: [{ active: "desc" }, { code: "desc" }],
    select: { id: true, code: true, title: true, active: true, importedAt: true, sourceFileName: true, _count: { select: { initiatives: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Admin
      </Link>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Plan versions</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Choose which planning period appears in the Overview and Initiative List. Historical records remain preserved when a plan is not active.
      </p>
      {saved && <p className="mt-4 rounded-lg border border-ok/40 bg-ok-soft px-3.5 py-2.5 text-sm text-ink">{saved} is now active.</p>}
      {error && <p className="mt-4 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">The plan could not be activated.</p>}

      <div className="mt-6 flex flex-col gap-3">
        {plans.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">
            No plan versions have been imported yet. Run the FY27 import after applying the database migration.
          </div>
        ) : plans.map((plan) => (
          <div key={plan.id} className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${plan.active ? "border-ok/50 bg-ok-soft/30" : "border-border bg-surface"}`}>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">{plan.code}</h2>
                {plan.active && <span className="inline-flex items-center gap-1 rounded bg-ok-soft px-1.5 py-0.5 text-[10px] font-semibold text-ok"><Check size={11} aria-hidden /> Active</span>}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{plan.title}</p>
              <p className="mt-1 text-[11px] text-ink-faint">
                {plan._count.initiatives} initiatives · {plan.sourceFileName ?? "No source file"}
                {plan.importedAt ? ` · imported ${plan.importedAt.toLocaleDateString()}` : ""}
              </p>
            </div>
            {!plan.active && (
              <form action={adminActivatePlan}>
                <input type="hidden" name="planVersionId" value={plan.id} />
                <button type="submit" className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-deep">
                  Make active
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
