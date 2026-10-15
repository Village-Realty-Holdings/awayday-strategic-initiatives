import {
  ACTION_ITEMS,
  AREAS,
  ELT_ASKS,
  INITIATIVE_UPDATES,
  MILESTONES,
  MOCK_TODAY,
  PEOPLE,
  SIS,
  personById,
} from "./data";
import { FINANCIALS, REVIEW_PERIODS, REVIEW_PILLARS, REVIEW_SO_WHATS } from "./review-content";
import type {
  InitiativeUpdate,
  MockArea,
  MockMilestone,
  MockSi,
  ReviewPeriod,
  ReviewPillar,
  ReviewSiSnapshot,
  ReviewSoWhat,
  UpdateState,
} from "./types";

// ---------------------------------------------------------------- dates

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** "5 Oct" */
export function fmtDay(iso: string): string {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Fri 16 Oct 2026" */
export function fmtLong(iso: string): string {
  const { y, m, d } = parts(iso);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtMonth(iso: string): string {
  const { y, m } = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = parts(fromIso);
  const b = parts(toIso);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function milestoneDateLabel(m: MockMilestone): string {
  if (m.approxLabel) return m.approxLabel;
  if (m.endDate) {
    const a = parts(m.date);
    const b = parts(m.endDate);
    return a.m === b.m ? `${a.d}-${b.d} ${MONTHS[a.m - 1]}` : `${fmtDay(m.date)} - ${fmtDay(m.endDate)}`;
  }
  return fmtDay(m.date);
}

export function isPastDue(m: MockMilestone, today = MOCK_TODAY): boolean {
  return !m.done && (m.endDate ?? m.date) < today;
}

// ------------------------------------------------------------- lookups

export function areaByCode(code: string): MockArea | undefined {
  return AREAS.find((a) => a.code === code);
}
export function areaName(code: string): string {
  if (code === "ALL") return "All";
  return areaByCode(code)?.name ?? code;
}
export function siByCode(code: string): MockSi | undefined {
  return SIS.find((s) => s.code === code);
}
export function siShortCode(code: string): string {
  return code.replace("FY27-", "");
}
export function sisForArea(areaCode: string): MockSi[] {
  return SIS.filter((s) => s.areaCode === areaCode);
}
export function names(ids: string[]): string {
  return ids.map((id) => personById(id)?.name ?? id).join(", ");
}

// -------------------------------------------------------------- periods

export const PERIODS = REVIEW_PERIODS;
export const LATEST_PERIOD = REVIEW_PERIODS.find((p) => p.status === "DRAFT") ?? REVIEW_PERIODS[0];

export function getPeriod(id: string): ReviewPeriod | undefined {
  return REVIEW_PERIODS.find((p) => p.id === id);
}
export function pillarsFor(periodId: string): ReviewPillar[] {
  return REVIEW_PILLARS.filter((p) => p.periodId === periodId);
}
export function soWhatsFor(periodId: string, scope: string): ReviewSoWhat[] {
  return REVIEW_SO_WHATS.filter((s) => s.periodId === periodId && s.scope === scope).sort((a, b) => a.order - b.order);
}
/** Periods that have section-level detail (charts, M&A, brand lists). Only September in the mock. */
const DETAIL_PERIODS = new Set(["2026-09"]);
export function hasDetail(periodId: string): boolean {
  return DETAIL_PERIODS.has(periodId);
}
export function financialsFor(periodId: string) {
  return FINANCIALS[periodId];
}

// -------------------------------------------------------------- updates

export function updateStateFor(siCode: string, periodId: string): UpdateState {
  return INITIATIVE_UPDATES.find((u) => u.siCode === siCode && u.period === periodId)?.state ?? "NOT_SUBMITTED";
}

export function updateForSiPeriod(siCode: string, periodId: string): InitiativeUpdate | undefined {
  return INITIATIVE_UPDATES.find((u) => u.siCode === siCode && u.period === periodId);
}

/** The review shows only submitted updates; drafts and gaps render as TBD. */
export function snapshotFor(siCode: string, periodId: string): ReviewSiSnapshot {
  const u = updateForSiPeriod(siCode, periodId);
  if (u && u.state === "SUBMITTED") {
    return { periodId, siCode, status: u.status, latestProgress: u.latestProgress, whatNext: u.whatNext, state: "SUBMITTED" };
  }
  return { periodId, siCode, status: null, latestProgress: null, whatNext: null, state: u?.state ?? "NOT_SUBMITTED" };
}

export function submissionCounts(periodId: string) {
  const counts = { SUBMITTED: 0, DRAFT: 0, NOT_SUBMITTED: 0 } as Record<UpdateState, number>;
  for (const si of SIS) counts[updateStateFor(si.code, periodId)] += 1;
  return counts;
}

// ------------------------------------------------------------ milestones

export function sortedMilestones(list: MockMilestone[] = MILESTONES): MockMilestone[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function milestonesBySi(siCode: string): MockMilestone[] {
  return sortedMilestones(MILESTONES.filter((m) => m.siCode === siCode));
}

/** Milestones due within the window (past-due and not done are always kept). */
export function upcomingMilestones(days: number | null, today = MOCK_TODAY): MockMilestone[] {
  const end = days === null ? "9999-12-31" : addDays(today, days);
  return sortedMilestones(MILESTONES.filter((m) => m.date <= end && (isPastDue(m, today) || (m.endDate ?? m.date) >= today)));
}

// --------------------------------------------------------------- leaders

export type LeaderGroup = {
  leaderId: string | null;
  leaderName: string;
  sis: MockSi[];
};

/** How the asks view groups SIs: by ELT owner of the area (default) or by the SI lead. */
export type LeaderGrouping = "elt" | "lead";

function sortGroups(groups: LeaderGroup[]): LeaderGroup[] {
  return groups.sort((a, b) => {
    if (a.leaderId === null) return 1;
    if (b.leaderId === null) return -1;
    return a.leaderName.localeCompare(b.leaderName);
  });
}

/**
 * Groups SIs under leaders. "elt" uses the area's ELT owners, so an SI in an
 * area with two ELT owners appears under both. "lead" uses the SI's own lead.
 */
export function leaderGroups(by: LeaderGrouping = "lead"): LeaderGroup[] {
  const map = new Map<string | null, MockSi[]>();
  const add = (id: string | null, si: MockSi) => {
    const list = map.get(id) ?? [];
    list.push(si);
    map.set(id, list);
  };
  for (const si of SIS) {
    if (by === "elt") {
      const owners = areaByCode(si.areaCode)?.eltOwnerIds ?? [];
      if (owners.length === 0) add(null, si);
      for (const id of owners) add(id, si);
    } else {
      add(si.ownerId, si);
    }
  }
  return sortGroups(
    [...map.entries()].map(([leaderId, sis]) => ({
      leaderId,
      leaderName: leaderId ? (personById(leaderId)?.name ?? leaderId) : by === "elt" ? "No ELT owner" : "Unassigned (owner TBD)",
      sis,
    })),
  );
}

export function openItemsForSi(siCode: string) {
  return {
    milestones: MILESTONES.filter((m) => m.siCode === siCode && !m.done),
    actions: ACTION_ITEMS.filter((a) => a.siCode === siCode && !a.done),
    asks: ELT_ASKS.filter((a) => a.siCode === siCode && a.open),
  };
}

export function sisForOwner(ownerId: string): MockSi[] {
  return SIS.filter((s) => s.ownerId === ownerId);
}

export function ownersWithMilestones() {
  const ids = new Set(MILESTONES.flatMap((m) => m.ownerIds));
  return PEOPLE.filter((p) => ids.has(p.id));
}
