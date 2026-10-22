import { requireApp } from "@/lib/session";
import { loadGanttData } from "@/lib/gantt-data";
import { BoardNarrative } from "@/components/board-narrative";
import { GanttChart } from "@/components/gantt-chart";
import { ReportingTabs } from "@/components/reporting-tabs";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reporting — Awayday" };

export default async function ReportingPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireApp("initiatives");
  const [{ view }, gantt] = await Promise.all([searchParams, loadGanttData()]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <ReportingTabs
        initialView={view === "gantt" ? "gantt" : "narrative"}
        narrative={
          <div className="max-w-[860px]">
            <header className="no-print mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-ink">Board Narrative</h1>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                Turn the live portfolio into a board-ready written update: where Awayday stands against the
                $150M exit, progress by 2026 goal, risk posture with dollars exposed, and the decisions to put
                in front of the board. Claude drafts from the current numbers (it never invents figures); you
                review and edit before it ships.
              </p>
            </header>
            <BoardNarrative />
          </div>
        }
        gantt={
          <>
            <header className="mb-5">
              <h1 className="text-xl font-semibold tracking-tight text-ink">Initiative Timeline</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Start-to-target windows with progress and a today marker. Filter by owner to see workload.
              </p>
            </header>
            <GanttChart {...gantt} />
          </>
        }
      />
    </div>
  );
}
