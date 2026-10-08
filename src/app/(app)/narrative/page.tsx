import { requireApp } from "@/lib/session";
import { BoardNarrative } from "@/components/board-narrative";

export const dynamic = "force-dynamic";

export const metadata = { title: "Board Narrative — Awayday" };

export default async function BoardNarrativePage() {
  await requireApp("initiatives");

  return (
    <div className="mx-auto max-w-[860px]">
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
  );
}
