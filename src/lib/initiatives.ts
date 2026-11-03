import type { InitiativeStatus, Quadrant } from "@/generated/prisma/client";

// An SI's one status. Per DESIGN.md, status is always color + glyph + label
// (never color alone), so it reads for colorblind users too.
type StatusDisplay = {
  label: string;
  glyph: string;
  fg: string;
  dot: string;
  variant: "ok" | "warn" | "risk" | "done" | "outline";
};

export const STATUS_META: Record<InitiativeStatus, StatusDisplay> = {
  COMPLETE: { label: "Complete", glyph: "■", fg: "text-done", dot: "bg-done", variant: "done" },
  ON_TRACK: { label: "On-track", glyph: "●", fg: "text-ok", dot: "bg-ok", variant: "ok" },
  AT_RISK: { label: "At-risk", glyph: "◆", fg: "text-warn", dot: "bg-warn", variant: "warn" },
  OFF_TRACK: { label: "Off-track", glyph: "▼", fg: "text-risk", dot: "bg-risk", variant: "risk" },
};

export const STATUS_ORDER: InitiativeStatus[] = ["COMPLETE", "ON_TRACK", "AT_RISK", "OFF_TRACK"];

const NO_STATUS: StatusDisplay = { label: "No status", glyph: "○", fg: "text-ink-faint", dot: "bg-ink-faint", variant: "outline" };

export function statusDisplay(status: InitiativeStatus | null | undefined): StatusDisplay {
  return status ? STATUS_META[status] : NO_STATUS;
}

/** Status filters' value for SIs with none set. */
export const NO_STATUS_FILTER = "NO_STATUS";
export const STATUS_FILTERS: string[] = [...STATUS_ORDER, NO_STATUS_FILTER];
export const statusFilterLabel = (value: string): string =>
  value === NO_STATUS_FILTER ? NO_STATUS.label : STATUS_META[value as InitiativeStatus].label;
export const matchesStatusFilter = (status: InitiativeStatus | null, filter: string): boolean =>
  !filter || (status ?? NO_STATUS_FILTER) === filter;

/** A submitted status, or null when it isn't one of the options. */
export function parseStatus(raw: string | null | undefined): InitiativeStatus | null {
  return STATUS_ORDER.includes(raw as InitiativeStatus) ? (raw as InitiativeStatus) : null;
}

export const QUADRANT_META: Record<Quadrant, { label: string; hint: string; fg: string; bg: string }> = {
  BIG_BET: { label: "Big Bet", hint: "High value · high effort", fg: "text-navy-deep", bg: "bg-navy/10" },
  QUICK_WIN: { label: "Quick Win", hint: "High value · low effort", fg: "text-ok", bg: "bg-ok-soft" },
  FILL_IN: { label: "Maybe", hint: "Low value · low effort", fg: "text-gold-deep", bg: "bg-gold/15" },
  AVOID: { label: "Avoid", hint: "Low value · high effort", fg: "text-risk", bg: "bg-risk-soft" },
};

// Scoring rubric (source: Tracker "Scoring Key"). Keeps Value/Lift scored consistently.
export const VALUE_SCALE: { n: number; label: string; def: string }[] = [
  { n: 1, label: "Marginal", def: "Barely moves a strategic metric." },
  { n: 2, label: "Modest", def: "Incremental but real progress on a goal." },
  { n: 3, label: "Solid", def: "Clearly contributes to a 2026 Goal or CIM driver." },
  { n: 4, label: "Major", def: "Meaningfully moves a top KPI; visible in board readouts." },
  { n: 5, label: "Transformational", def: "Shifts the trajectory toward the exit goal." },
];

export const LIFT_SCALE: { n: number; label: string; def: string }[] = [
  { n: 1, label: "Trivial", def: "Days of focused work." },
  { n: 2, label: "Light", def: "1–4 weeks of cross-functional work." },
  { n: 3, label: "Moderate", def: "Quarter-scale; one team, focused effort." },
  { n: 4, label: "Heavy", def: "1–2 quarters; multiple teams, dedicated PM." },
  { n: 5, label: "Massive", def: "Multi-quarter program; reorganization-level effort." },
];

// Derive the priority quadrant from Value × Lift (matches the Tracker labels + seed).
export function quadrantFor(value: number, lift: number): Quadrant {
  const highValue = value >= 4;
  const lowEffort = lift <= 3;
  if (highValue && lowEffort) return "QUICK_WIN";
  if (highValue && !lowEffort) return "BIG_BET";
  if (!highValue && lowEffort) return "FILL_IN";
  return "AVOID";
}

// Simplified scoring (2026-06, Jakob): the strategic Value score is derived
// straight from the Targeted Value ($, annualized) band rather than a separate
// 1-5 dropdown, and effort collapses to a single Small/Medium/Large picker.
export const VALUE_DOLLAR_BANDS: { max: number; n: number; label: string }[] = [
  { max: 100_000, n: 1, label: "<$100K" },
  { max: 500_000, n: 2, label: "$100–500K" },
  { max: 1_000_000, n: 3, label: "$500K–1M" },
  { max: 3_000_000, n: 4, label: "$1M–3M" },
  { max: Infinity, n: 5, label: "$3M+" },
];

// Targeted dollar value → 1-5 strategic value score. Null/0 keeps a neutral 3.
export function valueFromDollars(targeted: number | null | undefined): number {
  if (targeted == null || !Number.isFinite(targeted) || targeted <= 0) return 3;
  return VALUE_DOLLAR_BANDS.find((b) => targeted < b.max)?.n ?? 5;
}

export type Effort = "S" | "M" | "L";
export const EFFORT_OPTS: { v: Effort; label: string; hint: string }[] = [
  { v: "S", label: "Small", hint: "Days to a few weeks; one team" },
  { v: "M", label: "Medium", hint: "Quarter-scale; focused effort" },
  { v: "L", label: "Large", hint: "Multi-quarter; multiple teams" },
];

// Effort picker maps onto the stored 1-5 lift so the quadrant math is unchanged
// (lowEffort = lift ≤ 3 → Small/Medium are quick wins, Large is a big bet).
export function effortToLift(e: Effort): number {
  return e === "S" ? 1 : e === "M" ? 3 : 5;
}
export function liftToEffort(lift: number): Effort {
  if (lift <= 2) return "S";
  if (lift === 3) return "M";
  return "L";
}

// Full USD with thousands separators (Jakob: keep the real number, just add
// commas — e.g. 1_500_000 → "$1,500,000"). Not abbreviated to M/K.
export function formatMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

// Parse a money input that may carry "$", commas, spaces, and an M/K suffix
// into a plain number. Commas are stripped first (the old parser stopped at the
// first comma, so "1,500,000" wrongly parsed as 1).
export function parseDollars(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const m = cleaned.match(/^([\d.]+)([mMkK])?$/);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2]?.toLowerCase() === "m") n *= 1_000_000;
  else if (m[2]?.toLowerCase() === "k") n *= 1_000;
  return n;
}

// Normalize a money input for display in a text field: full number with commas
// (e.g. "1.5M" or "1500000" → "1,500,000"). Leaves unparseable text untouched.
export function formatDollarsInput(raw: string): string {
  const n = parseDollars(raw);
  return n == null ? raw : Math.round(n).toLocaleString("en-US");
}

// Working team (Initiative.supports) is stored as a JSON array of names so a name
// containing a comma no longer corrupts the round-trip (#13). Legacy rows are a
// plain comma-joined string, so reads fall back to comma-splitting.
export function parseTeam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = raw.trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* not JSON -> legacy comma list */ }
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export const formatTeam = (raw: string | null | undefined): string => parseTeam(raw).join(", ");
export const serializeTeam = (names: string[]): string => JSON.stringify(names);

// Charter Effort badge: L/M/H derived from lift (higher lift = more effort to ship).
export function effortBadge(lift: number): "L" | "M" | "H" {
  if (lift >= 4) return "H";
  if (lift === 3) return "M";
  return "L";
}

// Whole-day duration between two dates, for charter timelines.
export function durationDays(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function formatDateShort(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateDay(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Schedule pace: expected % complete given today vs actual. Drives slippage flags.
export function pace(start: Date | null, end: Date | null, pct: number, now: Date) {
  if (!start || !end) return null;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return null;
  const elapsed = Math.min(Math.max(now.getTime() - start.getTime(), 0), total);
  const expected = elapsed / total;
  const lag = pct - expected; // negative => behind schedule
  return { expected, lag };
}

// Tooltip placement for a Lift × Value dot at (x%, bottom y%). The chart box is
// overflow-hidden, so the tooltip must open away from any nearby edge: flip
// above the dot near the bottom, and pin to the dot's left/right edge near the
// sides instead of centering. Alex demo 2026-08-19: bottom-row dots showed no
// tooltip at all (fully clipped).
export function quadrantTooltipClasses(x: number, y: number): string {
  const vertical = y < 30 ? "bottom-4" : "top-4";
  const horizontal = x < 15 ? "left-0" : x > 85 ? "right-0" : "left-1/2 -translate-x-1/2";
  return `${vertical} ${horizontal}`;
}
