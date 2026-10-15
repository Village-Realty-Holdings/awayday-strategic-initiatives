import { canEdit, requireApp } from "@/lib/session";
import { DataInputsView, type DataSourceRow } from "../_components/data-inputs-view";
import { V2Header } from "../_components/preview";
import { DATA_SOURCES } from "../_mock/data-inputs";
import { MOCK_TODAY } from "../_mock/data";
import { daysBetween, fmtDay, LATEST_PERIOD } from "../_mock/selectors";

function ageLabel(iso: string | null): string {
  if (!iso) return "never";
  const d = daysBetween(iso, MOCK_TODAY);
  return d === 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

export default async function DataInputsPage() {
  const session = await requireApp("initiatives");
  const sources: DataSourceRow[] = DATA_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    artifact: s.artifact,
    kind: s.kind,
    owner: s.owner,
    cadence: s.cadence,
    feeds: s.feeds,
    lastLoadedLabel: s.lastLoaded ? fmtDay(s.lastLoaded) : "Not yet",
    lastLoadedBy: s.lastLoadedBy,
    ageLabel: ageLabel(s.lastLoaded),
    status: s.status,
    rows: s.rows,
    note: s.note,
  }));
  const initialLog = [...DATA_SOURCES]
    .filter((s) => s.lastLoaded)
    .sort((a, b) => (b.lastLoaded ?? "").localeCompare(a.lastLoaded ?? ""))
    .map((s) => ({
      id: `seed-${s.id}`,
      when: fmtDay(s.lastLoaded as string),
      source: s.name,
      what: s.artifact,
      by: s.lastLoadedBy,
    }));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <V2Header
        eyebrow="Admin"
        title="Data inputs"
        description="How the numbers get into the review: the monthly Finance, ranking, market, M&A and AwayDNA sources, when each was last loaded, and a mock load control."
      />
      <DataInputsView
        sources={sources}
        initialLog={initialLog}
        todayLabel={fmtDay(MOCK_TODAY)}
        periodLabel={LATEST_PERIOD.label}
        canLoad={canEdit(session.user.role)}
      />
    </div>
  );
}
