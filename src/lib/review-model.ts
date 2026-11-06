// Pure building blocks for the monthly strategy review (no database access,
// safe to import from client components; KPI shaping lives in review-kpi.ts).
// `review-data.ts` loads rows and hands them to these functions, so the shaping
// rules (areas for plans without StrategicArea rows, periods, the financial
// table, owner matching, pillar status) can be tested without Prisma.

import type { InitiativeStatus } from "@/generated/prisma/client";
import { appNow } from "@/lib/clock";

export const BELOW_LINE_STATUSES = ["NOT_STARTED", "ON_TRACK", "AT_RISK", "BLOCKED", "DONE"] as const;
export type BelowLineStatus = (typeof BELOW_LINE_STATUSES)[number];

export type AreaKind = "VALUE_DRIVER" | "ENABLER";
export type PillarTone = "ahead" | "on_track" | "behind";

/** A status set by hand on a pillar for one month. */
export const PILLAR_STATUSES = ["AHEAD", "ON_TRACK", "BEHIND"] as const;
export type PillarStatus = (typeof PILLAR_STATUSES)[number];
export const PILLAR_STATUS_RAG: Record<PillarStatus, Rag> = { AHEAD: "GREEN", ON_TRACK: "AMBER", BEHIND: "RED" };
export type Rag = "GREEN" | "AMBER" | "RED" | "GREY";

export type ReviewMilestone = {
  id: string;
  siId: string;
  siCode: string;
  siName: string;
  areaCode: string;
  title: string;
  owner: string | null;
  /** ISO day (YYYY-MM-DD), or null when the charter has no date. */
  date: string | null;
  done: boolean;
};

export type ReviewAction = {
  id: string;
  siCode: string;
  kind: string;
  title: string;
  owner: string;
  date: string | null;
  done: boolean;
};

export type ReviewAsk = {
  id: string;
  siCode: string;
  request: string;
  kind: string;
  status: string;
  raisedOn: string;
};

export type ReviewSi = {
  id: string;
  code: string;
  shortCode: string;
  name: string;
  areaCode: string;
  areaName: string;
  lead: string | null;
  sponsor: string | null;
  ownerUserId: string | null;
  /** The charter objective (valueWhenComplete). */
  objective: string | null;
  /** "Metric: target" from the charter KPI, or null. */
  kpi: string | null;
  /** One-line aim for cards: the KPI, else the objective. */
  goingFor: string | null;
  /** This period's update status, else the SI's current one; null renders "No status". */
  status: InitiativeStatus | null;
  /** The SI's headline KPI or leading measure against its target; null when it has none. */
  value: ReviewSiValue | null;
  latestProgress: string | null;
  whatNext: string | null;
  updatedThisPeriod: boolean;
  updatedBy: string | null;
  milestones: ReviewMilestone[];
  actions: ReviewAction[];
  asks: ReviewAsk[];
};

export type ReviewSiValue = {
  name: string;
  /** Formatted latest value; null when none has been entered. */
  latest: string | null;
  /** Formatted target; null when none is set. */
  target: string | null;
  rag: Rag;
};

export type ReviewMeasure = {
  /** The area's KPI definition; null when the plan names a measure but none is defined. */
  kpiId: string | null;
  name: string;
  value: string | null;
  target: string | null;
  rag: Rag;
  /** Where this month's value came from: typed in on the review, a loaded document, worked out from imported metrics, or none yet. */
  source: "manual" | "import" | "derived" | null;
  /** The metrics a derived value was worked out from. */
  inputs?: string[];
  /** The status from the value and target, before any set by hand. `rag` is what shows. */
  calculatedRag?: Rag;
  /** The status set by hand for this pillar and month, if any. */
  statusOverride?: PillarStatus | null;
  /** Where the value came from and how its status was reached, for the pillar editor. */
  origin?: MeasureOrigin;
};

export type MeasureOrigin = {
  value: { summary: string; details: string[] };
  /** What the mapped inputs work out to, whatever value the measure shows. */
  calculated: { value: string | null; note: string | null };
  status: {
    label: string;
    /** The budget target as a number, or null when the status has none to compare with. */
    budget: string | null;
    /** Value minus budget, signed, e.g. "+$8.5M (+32.7%)". */
    difference: string | null;
    verdict: "better" | "worse" | "on target" | null;
    direction: "Higher is better" | "Lower is better" | null;
    basis: string;
  };
};

export type ReviewArea = {
  /** StrategicArea id; null for areas synthesised from a plan without areas. */
  id: string | null;
  code: string;
  name: string;
  kind: AreaKind;
  /** 1-based pillar number for value drivers. */
  number: number | null;
  goal: string | null;
  /** StrategicArea.owner as stored; null when unset or synthesised. */
  owner: string | null;
  /** The owner, else the SI leads joined, for display. */
  ownerLine: string | null;
  measure: ReviewMeasure | null;
  sis: ReviewSi[];
};

// ---------------------------------------------------------------------------
// Dates and labels
// ---------------------------------------------------------------------------

export function isoDay(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function todayIso(now: Date = appNow()): string {
  return now.toISOString().slice(0, 10);
}

export function addDaysIso(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** "5 Oct" */
export function fmtDay(day: string | null): string {
  if (!day) return "No date";
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "5 Oct 2026" */
export function fmtLong(day: string | null): string {
  if (!day) return "No date";
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-09" → "September 2026"; anything else is shown as-is. */
export function periodLabel(period: string): string {
  if (!PERIOD_PATTERN.test(period)) return period;
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function periodMonthName(period: string): string {
  if (!PERIOD_PATTERN.test(period)) return period;
  return MONTHS[Number(period.slice(5, 7)) - 1];
}

/** The month before `now`, as YYYY-MM: the review discusses last month's results. */
export function previousMonth(now: Date = appNow()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

/** The month after a YYYY-MM period: "2026-12" → "2027-01". */
export function monthAfter(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

/**
 * Review periods, newest first: every YYYY-MM period that has KPI data, SI
 * updates or a stored ReviewPeriod row. With none, last month, so the page
 * always has a period.
 */
export function reviewPeriods(candidates: readonly (string | null | undefined)[], now: Date = appNow()): string[] {
  const set = new Set(candidates.filter((p): p is string => typeof p === "string" && PERIOD_PATTERN.test(p)));
  if (set.size === 0) set.add(previousMonth(now));
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** Periods Inbox offers: last month is always there, so a new month opens without anyone creating it. */
export function updatePeriods(periods: readonly string[], now: Date = appNow()): string[] {
  return reviewPeriods([...periods, previousMonth(now)], now);
}

/**
 * The month `/` opens on: the newest published review, or the newest period
 * when nothing is published yet (so a fresh draft month doesn't replace a
 * published review for everyone).
 */
export function homeReviewPeriod(periods: readonly string[], published: readonly string[]): string {
  return periods.find((p) => published.includes(p)) ?? periods[0];
}

/** The month Inbox opens on: the newest month still open for updates. */
/** Items under their SI, keeping their order: SIs with past-due items first, then open ones, then finished ones. */
export function groupItemsBySi<T extends { siId: string; done: boolean; pastDue: boolean }>(items: readonly T[]): { siId: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.siId, [...(groups.get(item.siId) ?? []), item]);
  const rank = (group: T[]) => (group.some((i) => i.pastDue) ? 0 : group.some((i) => !i.done) ? 1 : 2);
  return [...groups.entries()].map(([siId, group]) => ({ siId, items: group })).sort((a, b) => rank(a.items) - rank(b.items));
}

/** Whether a month's update is the SI's newest, so its status is the current one. Free-text legacy periods don't count. */
export function isNewestPeriod(period: string | null, others: readonly (string | null)[]): boolean {
  if (!period) return true;
  return !others.some((p) => p && PERIOD_PATTERN.test(p) && p > period);
}

export function openUpdatePeriod(periods: readonly string[], published: readonly string[]): string {
  return periods.find((p) => !published.includes(p)) ?? periods[0];
}

// ---------------------------------------------------------------------------
// Review periods and so-whats
// ---------------------------------------------------------------------------

export const REVIEW_PERIOD_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type ReviewPeriodStatus = (typeof REVIEW_PERIOD_STATUSES)[number];

/** So-what scope for the review summary; any other scope is a StrategicArea code. */
export const SUMMARY_SCOPE = "SUMMARY";

export type SoWhat = { id: string; headline: string; body: string | null };

export type SoWhatInput = { scope: string; order: number; headline: string; body: string | null };

export const SO_WHAT_LIMITS = { perScope: 12, headline: 200, body: 2000 } as const;

/**
 * The editor's so-whats (JSON `[{ scope, headline, body }]`) as rows to store:
 * unknown scopes and blank rows dropped, text trimmed and capped, and `order`
 * numbered per scope in the order given. Invalid JSON yields no rows.
 */
export function parseSoWhats(json: string | null, scopes: readonly string[]): SoWhatInput[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json ?? "[]");
  } catch {
    return [];
  }
  return normalizeSoWhats(raw, scopes);
}

/** As parseSoWhats, for a list that is already parsed (e.g. MCP tool input). */
export function normalizeSoWhats(raw: unknown, scopes: readonly string[]): SoWhatInput[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(scopes);
  const count = new Map<string, number>();
  const out: SoWhatInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { scope, headline, body } = item as Record<string, unknown>;
    if (typeof scope !== "string" || !allowed.has(scope)) continue;
    const h = typeof headline === "string" ? headline.trim().slice(0, SO_WHAT_LIMITS.headline) : "";
    const b = typeof body === "string" ? body.trim().slice(0, SO_WHAT_LIMITS.body) : "";
    if (!h && !b) continue;
    const order = count.get(scope) ?? 0;
    if (order >= SO_WHAT_LIMITS.perScope) continue;
    count.set(scope, order + 1);
    // A body with no headline leads with its first sentence as the headline.
    out.push({ scope, order, headline: h || b.slice(0, SO_WHAT_LIMITS.headline), body: h ? b || null : null });
  }
  return out;
}

/** "2026-11-05" → a Date at UTC midnight; anything else → null. */
export function parseIsoDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || isoDay(date) !== value ? null : date;
}

export function shortCode(code: string): string {
  return code.replace(/^FY\d{2}-/, "");
}

/** Split "Dan Yankley / Justin Ridgeway" or "A, B" into names. */
export function splitNames(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\s*(?:\/|,|&| and )\s*/)
    .map((n) => n.trim())
    .filter((n) => n && n.toUpperCase() !== "TBD");
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

export function initiativeOwnerMatches(initiative: { ownerUserId: string | null; teamLead: string | null }, user: { id: string; name: string }) {
  if (initiative.ownerUserId) return initiative.ownerUserId === user.id;
  const me = user.name.trim().toLowerCase();
  return splitNames(initiative.teamLead).some((n) => n.toLowerCase() === me);
}

// ---------------------------------------------------------------------------
// Areas for plans without StrategicArea rows (FY26 groups by cimDriver)
// ---------------------------------------------------------------------------

const ENABLER_PREFIX = /^key enablers?\s*[—–-]\s*/i;
const VALUE_DRIVER_ORDER = [/m\s*&\s*a/i, /grow|new units?/i, /retention/i, /trevpar/i, /margin/i];

export type SynthesisedArea = { code: string; name: string; kind: AreaKind; order: number; driver: string };

function slug(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "OTHER";
}

/**
 * One area per distinct `cimDriver`. "Key Enablers — Talent" becomes the
 * enabler "Talent"; the rest are value drivers, ordered like the FY27 house
 * (M&A, Grow, Retention, TRevPAR, Margin), then alphabetically.
 */
export function synthesiseAreas(drivers: readonly (string | null)[]): SynthesisedArea[] {
  const distinct = [...new Set(drivers.map((d) => (d && d.trim()) || "Other"))];
  const rank = (name: string) => {
    const i = VALUE_DRIVER_ORDER.findIndex((re) => re.test(name));
    return i === -1 ? VALUE_DRIVER_ORDER.length : i;
  };
  const areas = distinct.map((driver) => {
    const enabler = ENABLER_PREFIX.test(driver);
    const name = enabler ? driver.replace(ENABLER_PREFIX, "").trim() : driver;
    return { code: slug(name), name, kind: (enabler ? "ENABLER" : "VALUE_DRIVER") as AreaKind, order: 0, driver };
  });
  const sorted = [
    ...areas.filter((a) => a.kind === "VALUE_DRIVER").sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)),
    ...areas.filter((a) => a.kind === "ENABLER").sort((a, b) => a.name.localeCompare(b.name)),
  ];
  return sorted.map((a, i) => ({ ...a, order: i }));
}

// ---------------------------------------------------------------------------
// Pillar status from a KPI value against its target
// ---------------------------------------------------------------------------

function numberFromText(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/[$,%\s,]/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

export function ragFor(value: string | null, target: string | null, quality = "VALID"): Rag {
  if (quality === "UNAVAILABLE" || quality === "INVALID" || value === null) return "GREY";
  if (quality === "STALE") return "AMBER";
  const actual = numberFromText(value);
  const goal = numberFromText(target);
  if (actual === null || goal === null) return "GREY";
  return ragAgainst(actual, goal, Boolean(target?.trim().startsWith("<")));
}

/** Amber within 10% of the goal on either side; otherwise green when better than it and red when worse. */
export function ragAgainst(actual: number, goal: number, lowerIsBetter: boolean): Rag {
  if (Math.abs(actual - goal) <= Math.abs(goal) * 0.1) return "AMBER";
  return (lowerIsBetter ? actual < goal : actual > goal) ? "GREEN" : "RED";
}

export function ragTone(rag: Rag): PillarTone | null {
  if (rag === "GREEN") return "ahead";
  if (rag === "AMBER") return "on_track";
  if (rag === "RED") return "behind";
  return null;
}

export function ragLabel(rag: Rag): string {
  if (rag === "GREEN") return "Ahead";
  if (rag === "AMBER") return "On track";
  if (rag === "RED") return "Behind";
  return "No data";
}
