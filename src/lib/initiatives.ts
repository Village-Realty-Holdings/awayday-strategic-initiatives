import type { InitiativeStatus, Quadrant, ImpactLevel, DmaicStage } from "@/generated/prisma/client";

// Status display metadata. Per DESIGN.md, status is always color + glyph + label
// (never color alone), so it reads for colorblind users too.
export const STATUS_META: Record<
  InitiativeStatus,
  { label: string; glyph: string; fg: string; dot: string }
> = {
  NOT_STARTED: { label: "Not started", glyph: "○", fg: "text-ink-faint", dot: "bg-ink-faint" },
  PLANNING: { label: "Planning", glyph: "◔", fg: "text-navy", dot: "bg-navy" },
  IN_PROGRESS: { label: "In progress", glyph: "●", fg: "text-ok", dot: "bg-ok" },
  AT_RISK: { label: "At risk", glyph: "▲", fg: "text-risk", dot: "bg-risk" },
  DONE: { label: "Done", glyph: "■", fg: "text-done", dot: "bg-done" },
};

export const QUADRANT_META: Record<Quadrant, { label: string; hint: string; fg: string; bg: string }> = {
  BIG_BET: { label: "Big Bet", hint: "High value · high effort", fg: "text-navy-deep", bg: "bg-navy/10" },
  QUICK_WIN: { label: "Quick Win", hint: "High value · low effort", fg: "text-ok", bg: "bg-ok-soft" },
  FILL_IN: { label: "Maybe", hint: "Low value · low effort", fg: "text-gold-deep", bg: "bg-gold/15" },
  AVOID: { label: "Avoid", hint: "Low value · high effort", fg: "text-risk", bg: "bg-risk-soft" },
};

export const IMPACT_LABEL: Record<ImpactLevel, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

// Six Sigma DMAIC delivery stage. Color ramp advances red -> orange -> yellow ->
// green -> purple as work moves toward Control (completion).
export const DMAIC_META: Record<DmaicStage, { label: string; n: number; bg: string; fg: string; dot: string }> = {
  DEFINE: { label: "Define", n: 1, bg: "bg-risk-soft", fg: "text-risk", dot: "bg-risk" },
  MEASURE: { label: "Measure", n: 2, bg: "bg-warn-soft", fg: "text-warn", dot: "bg-warn" },
  ANALYZE: { label: "Analyze", n: 3, bg: "bg-gold/20", fg: "text-gold-deep", dot: "bg-gold" },
  IMPROVE: { label: "Improve", n: 4, bg: "bg-ok-soft", fg: "text-ok", dot: "bg-ok" },
  CONTROL: { label: "Control", n: 5, bg: "bg-done/15", fg: "text-done", dot: "bg-done" },
};

export const DMAIC_ORDER: DmaicStage[] = ["DEFINE", "MEASURE", "ANALYZE", "IMPROVE", "CONTROL"];

// Theme order for grouping (matches the strategic spine).
export const CIM_DRIVER_ORDER = [
  "M&A",
  "Grow new units",
  "Owner retention",
  "Margin expansion",
  "TrevPAR expansion",
  "Key Enablers — Talent",
  "Key Enablers — Technology",
];

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

export const formatPct = (v: number) => `${Math.round(v * 100)}%`;

// Charter Impact badge: $ scale derived from strategic value (matches the Tracker heuristic).
export function impactBadge(value: number): string {
  return ["$", "$", "$$", "$$$", "$$$$", "$$$$"][Math.min(Math.max(value, 0), 5)];
}

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

// Four-state initiative health (pace-derived, not raw status). Drives dot/bar colors
// on the quadrant + Gantt views. Reuses the brand status palette.
export type Health = "complete" | "on-track" | "behind" | "at-risk";

export const HEALTH_META: Record<Health, { label: string; dot: string; bar: string; fg: string; soft: string }> = {
  "complete": { label: "Complete", dot: "bg-done", bar: "bg-done", fg: "text-done", soft: "bg-done/10" },
  "on-track": { label: "On track", dot: "bg-ok", bar: "bg-ok", fg: "text-ok", soft: "bg-ok-soft" },
  "behind": { label: "Behind", dot: "bg-warn", bar: "bg-warn", fg: "text-warn", soft: "bg-warn-soft" },
  "at-risk": { label: "At risk", dot: "bg-risk", bar: "bg-risk", fg: "text-risk", soft: "bg-risk-soft" },
};

export const HEALTH_ORDER: Health[] = ["on-track", "behind", "at-risk", "complete"];

export function siHealth(
  status: InitiativeStatus,
  pct: number,
  start: Date | null,
  end: Date | null,
  now: Date,
): Health {
  if (status === "DONE" || pct >= 0.999) return "complete";
  if (status === "AT_RISK") return "at-risk";
  if (start && end) {
    const s = start.getTime();
    const e = end.getTime();
    const n = now.getTime();
    if (e > s) {
      if (n < s) return "on-track";
      const expected = (n - s) / (e - s);
      if (pct >= expected * 0.95) return "on-track";
      if (pct >= expected * 0.7) return "behind";
      return "at-risk";
    }
  }
  if (pct >= 0.7) return "on-track";
  if (pct >= 0.4) return "behind";
  return "at-risk";
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
