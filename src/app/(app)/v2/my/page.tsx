import Link from "next/link";
import { requireApp } from "@/lib/session";
import { MyUpdates, type MySiRow } from "../_components/my-updates";
import { MockNote, V2Header } from "../_components/preview";
import { ACTION_ITEMS, MOCK_CURRENT_USER_ID, MOCK_TODAY, personName } from "../_mock/data";
import {
  areaName,
  daysBetween,
  fmtDay,
  fmtLong,
  getPeriod,
  isPastDue,
  LATEST_PERIOD,
  milestonesBySi,
  PERIODS,
  siShortCode,
  sisForOwner,
  updateForSiPeriod,
} from "../_mock/selectors";

export default async function MySisPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireApp("initiatives");
  const { period: periodParam } = await searchParams;
  const period = (periodParam && getPeriod(periodParam)) || LATEST_PERIOD;
  const locked = period.status === "PUBLISHED";

  const rows: MySiRow[] = sisForOwner(MOCK_CURRENT_USER_ID).map((si) => {
    const u = updateForSiPeriod(si.code, period.id);
    return {
      code: si.code,
      shortCode: siShortCode(si.code),
      name: si.name,
      areaName: areaName(si.areaCode),
      state: u?.state ?? "NOT_SUBMITTED",
      status: u?.status ?? null,
      latestProgress: u?.latestProgress ?? "",
      whatNext: u?.whatNext ?? "",
      milestones: milestonesBySi(si.code).map((m) => ({
        id: m.id,
        text: m.title,
        due: m.date,
        dueLabel: fmtDay(m.date),
        done: m.done,
        pastDue: isPastDue(m),
      })),
      actions: ACTION_ITEMS.filter((a) => a.siCode === si.code && a.ownerId === MOCK_CURRENT_USER_ID).map((a) => ({
        id: a.id,
        text: a.text,
        due: a.due,
        dueLabel: fmtDay(a.due),
        done: a.done,
        pastDue: !a.done && a.due < MOCK_TODAY,
      })),
    };
  });

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <V2Header
        eyebrow="My SIs"
        title={`My SIs · ${period.label}`}
        description={`Your monthly update for each SI you lead: a status, latest progress, and what next. Mock persona: ${personName(MOCK_CURRENT_USER_ID)}.`}
        actions={
          <nav aria-label="Update month" className="inline-flex overflow-hidden rounded-md border border-border bg-surface text-xs">
            {PERIODS.map((p) => (
              <Link
                key={p.id}
                href={`/v2/my?period=${p.id}`}
                aria-current={p.id === period.id ? "page" : undefined}
                className={`px-3 py-1.5 ${p.id === period.id ? "bg-navy/10 font-medium text-navy-deep" : "text-ink-muted hover:bg-surface-2"}`}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        }
      />
      <div>
        <MockNote>Mock — not saved. Submitting only changes this page until you reload.</MockNote>
      </div>
      <MyUpdates
        key={period.id}
        rows={rows}
        locked={locked}
        periodLabel={period.label}
        dueLabel={fmtLong(period.updatesDueDate)}
        daysLeft={daysBetween(MOCK_TODAY, period.updatesDueDate)}
      />
    </div>
  );
}
