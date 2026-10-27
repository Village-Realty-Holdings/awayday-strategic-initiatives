// Pure building blocks for the monthly strategy review (no database access,
// safe to import from client components; KPI shaping lives in review-kpi.ts).
// `review-data.ts` loads rows and hands them to these functions, so the shaping
// rules (areas for plans without StrategicArea rows, periods, the financial
// table, owner matching, pillar status) can be tested without Prisma.

export const SI_REVIEW_STATUSES = ["AHEAD", "ON_TRACK", "AT_RISK", "BEHIND"] as const;
export type SiReviewStatus = (typeof SI_REVIEW_STATUSES)[number];

export const BELOW_LINE_STATUSES = ["NOT_STARTED", "ON_TRACK", "AT_RISK", "BLOCKED", "DONE"] as const;
export type BelowLineStatus = (typeof BELOW_LINE_STATUSES)[number];

export type AreaKind = "VALUE_DRIVER" | "ENABLER";
export type PillarTone = "ahead" | "on_track" | "watch" | "behind";
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
  what: string | null;
  goingFor: string | null;
  /** Review status from this period's update; null renders "Status TBD". */
  status: SiReviewStatus | null;
  latestProgress: string | null;
  whatNext: string | null;
  updatedThisPeriod: boolean;
  updatedBy: string | null;
  milestones: ReviewMilestone[];
  actions: ReviewAction[];
  asks: ReviewAsk[];
};

export type ReviewMeasure = {
  name: string;
  value: string | null;
  target: string | null;
  rag: Rag;
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

export function todayIso(now: Date = new Date()): string {
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
export function previousMonth(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Review periods, newest first: every YYYY-MM period that has KPI data or SI
 * updates. With neither, last month, so the page always has a period.
 */
export function reviewPeriods(candidates: readonly (string | null | undefined)[], now: Date = new Date()): string[] {
  const set = new Set(candidates.filter((p): p is string => typeof p === "string" && PERIOD_PATTERN.test(p)));
  if (set.size === 0) set.add(previousMonth(now));
  return [...set].sort((a, b) => b.localeCompare(a));
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
  const lowerIsBetter = Boolean(target?.trim().startsWith("<"));
  const good = lowerIsBetter ? actual <= goal : actual >= goal;
  const distance = goal === 0 ? 0 : Math.abs(actual - goal) / Math.abs(goal);
  if (good) return "GREEN";
  return distance <= 0.1 ? "AMBER" : "RED";
}

export function ragTone(rag: Rag): PillarTone | null {
  if (rag === "GREEN") return "on_track";
  if (rag === "AMBER") return "watch";
  if (rag === "RED") return "behind";
  return null;
}

export function ragLabel(rag: Rag): string {
  if (rag === "GREEN") return "On track";
  if (rag === "AMBER") return "Watch";
  if (rag === "RED") return "Behind";
  return "No data";
}
