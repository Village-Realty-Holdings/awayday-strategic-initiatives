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
export const PILLAR_STATUS_WORD: Record<PillarStatus, string> = { AHEAD: "Ahead", ON_TRACK: "On track", BEHIND: "Behind" };
export type Rag = "GREEN" | "AMBER" | "RED" | "GREY";

/**
 * An approved pillar status may carry the reviewer's own wording after the
 * status word, e.g. "Ahead · CAC off track" or "On track reported · October
 * under PY". The status word selects the colour; the wording after it is the
 * business statement that was approved and is shown exactly as it was written.
 *
 * This keeps a combined reading combined: an "Ahead · CAC off track" pillar is
 * not reduced to "Ahead" and its warning is not lost. The vocabulary below is
 * only the status words themselves — no business wording lives in code — and a
 * stored value that does not begin with one of them is not a status at all, so
 * an unrecognised value shows nothing rather than an invented colour.
 */
const APPROVED_STATUS_PREFIXES: readonly { prefix: string; status: PillarStatus }[] = [
  // "on goal" is the same claim as "on track" in the October review's own words
  // ("On goal ex-OTA · behind reported").
  { prefix: "on track", status: "ON_TRACK" },
  { prefix: "on goal", status: "ON_TRACK" },
  { prefix: "ahead", status: "AHEAD" },
  { prefix: "behind", status: "BEHIND" },
];

export type ApprovedPillarStatus = {
  /** The status word, which selects the colour. */
  status: PillarStatus;
  /** What to show: the approved wording, or the plain status word when none was added. */
  wording: string;
  /** True when the reviewer added wording after the status word. */
  custom: boolean;
};

/**
 * Read an approved status stored on a pillar for a month. Accepts both the
 * plain form ("AHEAD", as the September review stored it) and the combined form
 * ("Ahead · CAC off track"). Anything else returns null.
 */
export function parseApprovedPillarStatus(stored: string | null | undefined): ApprovedPillarStatus | null {
  const value = (stored ?? "").trim();
  if (!value) return null;
  // The stored status may be the machine form ("ON_TRACK") or the reviewer's
  // wording ("On track reported · October under PY"); both read the same word.
  const lower = value.toLowerCase().replace(/_/g, " ");
  for (const { prefix, status } of APPROVED_STATUS_PREFIXES) {
    if (!lower.startsWith(prefix)) continue;
    // The status word has to end where it ends: "ahead" is a status,
    // "aheadness" is not one that this vocabulary knows.
    const rest = lower.slice(prefix.length);
    if (rest && /[a-z0-9]/.test(rest[0])) continue;
    // "AHEAD", "Ahead" and "Ahead of plan" all mean ahead; only the last one
    // carries wording of its own to show.
    return { status, wording: rest ? value : PILLAR_STATUS_WORD[status], custom: Boolean(rest) };
  }
  return null;
}

export function isApprovedPillarStatus(stored: string | null | undefined): boolean {
  return parseApprovedPillarStatus(stored) !== null;
}

/**
 * Why a review pillar's calculated status could not be established. The
 * reviewed October report judges each pillar against its 2026 goal, so a pillar
 * whose goal, direction or reporting basis is not configured shows "Not
 * configured" rather than a status borrowed from an FY27 figure.
 */
export const MEASURE_STATUS_GAPS = ["no-direction", "no-basis", "no-goal", "goal-quantity-unknown", "goal-not-comparable", "no-value"] as const;
export type MeasureStatusGap = (typeof MEASURE_STATUS_GAPS)[number];

/** The neutral label the review uses when no status can be claimed. */
export const NOT_CONFIGURED_LABEL = "Not configured";

/** What each gap means, in the review's own words. Shown beside a neutral status. */
export const STATUS_GAP_TEXT: Record<MeasureStatusGap, string> = {
  "no-direction": "The measure mapping does not state which direction is better, so no status is claimed.",
  "no-basis": "The measure mapping does not declare a reporting basis, so the figures cannot be judged against a goal.",
  "no-goal": "No 2026 goal is stated for this measure, so no status is claimed. FY27 budget and stretch are shown for context only.",
  "goal-quantity-unknown":
    "The measure or its 2026 goal does not state a quantity (currency, count, percent or points), so the two are not compared and no status is claimed.",
  "goal-not-comparable":
    "The 2026 goal is written in a different quantity from the measure, so the two are not compared and no status is claimed.",
  "no-value": "There is no value for this month, so no status is claimed.",
};

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

/**
 * A second figure for the same measure on its other stated basis, e.g. TRevPAR
 * growth ex-OTA beside the reported figure, or shop NOI margin reported beside
 * the ex-OTA figure the goal is set on. Both figures are reviewed observations:
 * nothing here is derived, blended or written into code.
 */
export type ReviewSecondaryFigure = {
  /** The reviewed definition the figure came from. */
  kpiId: string;
  name: string;
  /** The basis word the definition's own name states: "ex-OTA" or "reported". */
  label: string;
  value: string;
  /** The time basis of the observation, e.g. "YTD". */
  basis: string | null;
  basisLabel: string;
  displayFormat: string | null;
  unit: string | null;
};

/**
 * The review's own word for a reporting basis. A monthly figure is named by its
 * month ("October"); a year-to-date figure is "YTD", never the month's name.
 * Labelling a YTD observation as monthly is the defect this exists to prevent.
 */
export function reviewBasisLabel(timeBasis: string | null | undefined, monthName: string): string {
  switch ((timeBasis ?? "YTD").toUpperCase()) {
    case "MONTHLY":
      return monthName;
    case "YTD":
      return "YTD";
    case "LTM":
    case "TTM":
      return "LTM";
    case "POINT_IN_TIME":
      return "Point in time";
    default:
      return timeBasis ?? "YTD";
  }
}

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
  /** The approved status exactly as stored, e.g. "AHEAD" or "Ahead · CAC off track". */
  approvedStatus?: string | null;
  /**
   * The reviewer's own wording after the status word, when one was approved
   * (e.g. "Ahead · CAC off track"). Shown as written; null for a plain status.
   */
  statusWording?: string | null;
  /**
   * How the primary measure was selected. `selected` means one active
   * KpiMeasureMapping names it; `missing` and `ambiguous` are neutral states and
   * show no value or status. Absent is treated as `selected` for older callers.
   */
  primary?: "selected" | "missing" | "ambiguous";
  /** When `primary` is ambiguous, the measures that each claim to be primary. */
  ambiguousKpis?: string[];
  /**
   * The direction the approved measure mapping declares, when one is configured.
   * `true`/`false` is an explicit declaration; `null` means a mapping exists but
   * states no direction (neutral); `undefined` means there is no mapping, so the
   * measure's name is the only direction source.
   */
  higherIsBetter?: boolean | null;
  /**
   * Why no calculated status is claimed (no 2026 goal, no declared basis, no
   * direction, or a goal in another quantity). Null when a status was reached.
   */
  statusGap?: MeasureStatusGap | null;
  /** How the primary measure was selected and how its status was reached. */
  origin?: MeasureOrigin;
  /**
   * The time basis of the observation `value` was read from ("YTD", "MONTHLY",
   * "LTM"). The headline states the basis it actually reports on.
   */
  basis?: string | null;
  /** That basis in the review's words: "YTD", "October", "LTM". */
  basisLabel?: string;
  /**
   * The month's own figure, when the headline value is a YTD or LTM figure. Shown
   * as supporting context ("October 330" beside "YTD 3,340"), never as the
   * headline. Null when the month's figure is the headline or is not stored.
   */
  monthValue?: string | null;
  /** The month that figure belongs to ("October"). */
  monthLabel?: string;
  /** The measure's declared format, so every renderer formats the same way. */
  displayFormat?: string | null;
  unit?: string | null;
  /** The same measure on its other stated basis, when both are reviewed. */
  secondary?: ReviewSecondaryFigure[];
};

export type MeasureOrigin = {
  value: { summary: string; details: string[] };
  /** What the mapped inputs work out to, whatever value the measure shows. */
  calculated: { value: string | null; note: string | null };
  status: {
    label: string;
    /** The goal the status compares with, or null when no status is claimed. */
    budget: string | null;
    /** What that figure is: "2026 goal" (or "goal"). Never an FY27 figure. */
    reference: string | null;
    /** FY27 budget/stretch, shown for context only; never the review's yardstick. */
    context: string | null;
    /** Why no status is claimed, or null when one is. */
    gap: MeasureStatusGap | null;
    /** Value minus that goal, signed, e.g. "+$8.5M (+32.7%)". */
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

/**
 * So-what scope for the commentary under the financial tables — the reviewed
 * report's "so what in the bridge" items. It is its own scope because it is not
 * a pillar and not the summary: four items about the financial bridge belong to
 * neither.
 */
export const FINANCIALS_SCOPE = "FINANCIALS";

/**
 * The tones a so-what can carry, as stored. These are meanings, not CSS class
 * names: presentation maps each one to its own border, glyph and spoken word.
 */
export const SO_WHAT_TONES = ["POSITIVE", "WARNING", "NEGATIVE", "NEUTRAL"] as const;
export type SoWhatToneValue = (typeof SO_WHAT_TONES)[number];

export type SoWhat = { id: string; headline: string; body: string | null; tone: SoWhatToneValue | null };

export type SoWhatInput = { scope: string; order: number; headline: string; body: string | null; tone: SoWhatToneValue | null };

export const SO_WHAT_LIMITS = { perScope: 12, headline: 200, body: 2000 } as const;

/**
 * The editor's so-whats (JSON `[{ scope, headline, body, tone }]`) as rows to
 * store: unknown scopes and blank rows dropped, text trimmed and capped, tones
 * validated against the stored vocabulary, and `order` numbered per scope in the
 * order given. Invalid JSON yields no rows. A tone that is absent or not one of
 * the four values is stored as null, which renders neutrally — never guessed
 * from the wording.
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
    const { scope, headline, body, tone } = item as Record<string, unknown>;
    if (typeof scope !== "string" || !allowed.has(scope)) continue;
    const h = typeof headline === "string" ? headline.trim().slice(0, SO_WHAT_LIMITS.headline) : "";
    const b = typeof body === "string" ? body.trim().slice(0, SO_WHAT_LIMITS.body) : "";
    if (!h && !b) continue;
    const order = count.get(scope) ?? 0;
    if (order >= SO_WHAT_LIMITS.perScope) continue;
    count.set(scope, order + 1);
    // A body with no headline leads with its first sentence as the headline.
    out.push({ scope, order, headline: h || b.slice(0, SO_WHAT_LIMITS.headline), body: h ? b || null : null, tone: normalizeSoWhatTone(tone) });
  }
  return out;
}

/** A stored or submitted tone, or null when it is absent or not one of the four. */
export function normalizeSoWhatTone(value: unknown): SoWhatToneValue | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return (SO_WHAT_TONES as readonly string[]).includes(upper) ? (upper as SoWhatToneValue) : null;
}

/**
 * Which scopes a month may store so-whats for: the summary, the financial
 * bridge, and one per area of the active plan.
 *
 * `FINANCIALS` is reserved. If an active plan happens to name a strategic area
 * with that code, the area keeps its own rows and the bridge scope is not
 * offered — a stored row is then never attributed to the wrong section.
 */
export function reviewSoWhatScopes(areaCodes: readonly string[]): { summary: string; financials: string | null; areas: string[] } {
  const areas = [...areaCodes];
  return { summary: SUMMARY_SCOPE, financials: areas.includes(FINANCIALS_SCOPE) ? null : FINANCIALS_SCOPE, areas };
}

/** Every scope a month may write, in the order the editor offers them. */
export function reviewSoWhatScopeList(areaCodes: readonly string[]): string[] {
  const { financials, areas } = reviewSoWhatScopes(areaCodes);
  return [SUMMARY_SCOPE, ...(financials ? [financials] : []), ...areas];
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

export function ragLabel(rag: Rag, gap: MeasureStatusGap | null = null): string {
  if (rag === "GREEN") return "Ahead";
  if (rag === "AMBER") return "On track";
  if (rag === "RED") return "Behind";
  // A neutral status that is neutral because nothing is configured says so, so
  // "No data" and "not set up" are not confused on the review.
  return gap ? NOT_CONFIGURED_LABEL : "No data";
}
