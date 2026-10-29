import { redirect } from "next/navigation";
import { requireApp } from "@/lib/session";
import { getActivePlan } from "@/lib/active-plan";
import { BoardNarrative } from "@/components/board-narrative";
import { PAGE_FRAME, PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reporting — Awayday" };

export default async function ReportingPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  // Warm the per-request active-plan lookup alongside the auth check.
  await Promise.all([requireApp("initiatives"), getActivePlan()]);
  const { view } = await searchParams;
  if (view === "gantt") redirect("/timeline");

  return (
    <div className={PAGE_FRAME}>
      <PageHeader sticky
        className="no-print"
        title="Reporting"
        description="A board-ready written update drawn from the live portfolio."
      />
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="no-print mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Board Narrative</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">
              A written update on where Awayday stands against its EBITDA objective, progress by goal, risk
              posture with dollars exposed, and the decisions to put in front of the board.
            </p>
          </header>
          <BoardNarrative />
        </div>
        <aside className="no-print grid gap-3 rounded-md border border-border bg-surface px-4 py-4 text-xs leading-5 text-ink-muted lg:sticky lg:top-20">
          <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">What the draft covers</h3>
          <ul className="grid gap-1.5">
            <li><b className="font-semibold text-ink">Position vs the objective.</b> The live EBITDA build against the plan target.</li>
            <li><b className="font-semibold text-ink">Progress by goal.</b> Initiative pace, what&apos;s ahead and what&apos;s behind.</li>
            <li><b className="font-semibold text-ink">Risk exposure.</b> CIM risks with the dollars at stake.</li>
            <li><b className="font-semibold text-ink">Decisions.</b> What the board is asked to weigh in on.</li>
          </ul>
          <p className="border-t border-border pt-3 text-note text-ink-faint">
            Claude drafts from the current numbers and never invents figures. Review and edit before it ships; drafts
            aren&apos;t saved, so save a PDF or copy the text.
          </p>
        </aside>
      </div>
    </div>
  );
}
