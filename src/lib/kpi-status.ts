// One vocabulary for "how is this going", shared by the strategy house, the
// executive cards, the KPI tables, the gauges and the so-whats.
//
// Two rules this module exists to enforce:
//
//  1. Direction is declared, not guessed from the sign of a number. Churn and
//     CAC improve when they fall; EBITDA improves when it rises. A delta is only
//     coloured favourable/unfavourable once its direction is known, otherwise it
//     stays neutral.
//  2. Status is never invented. A value with no comparable target is `no_data`,
//     and mixed results stay mixed (the summary says how many measures sit on
//     each side) instead of collapsing to one headline colour.
//
// Pure: no React, no database.

export const KPI_STATUSES = [
  "ahead",
  "on_goal",
  "on_track",
  "behind",
  "under_budget",
  "needs_attention",
  "floor_breached",
  "no_data",
] as const;

export type KpiStatus = (typeof KPI_STATUSES)[number];

/** The four visual treatments. Colour is always paired with a glyph and a word. */
export const STATUS_TONES = ["good", "warn", "crit", "neutral"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

export type KpiStatusMeta = {
  label: string;
  tone: StatusTone;
  /** Decorative: the label carries the meaning for assistive technology. */
  glyph: string;
  /** What the status claims, in plain English, for tooltips and help. */
  meaning: string;
  /** Severity ordering, so mixed results can report the worst tone. */
  rank: number;
};

export const KPI_STATUS_META: Record<KpiStatus, KpiStatusMeta> = {
  ahead: {
    label: "Ahead",
    tone: "good",
    glyph: "▲",
    meaning: "Measured against the goal, and better than it.",
    rank: 1,
  },
  on_goal: {
    label: "On goal",
    tone: "good",
    glyph: "●",
    meaning: "At the goal, within its agreed tolerance.",
    rank: 2,
  },
  on_track: {
    label: "On track",
    tone: "good",
    glyph: "●",
    meaning: "Meeting the approved plan for the period.",
    rank: 3,
  },
  behind: {
    label: "Behind",
    tone: "crit",
    glyph: "▼",
    meaning: "Measured against the goal, and worse than it.",
    rank: 6,
  },
  under_budget: {
    label: "Under budget",
    tone: "warn",
    glyph: "◆",
    meaning:
      "Below the approved budget. Amber by default; the reporting rule may treat it as red where the business does.",
    rank: 5,
  },
  needs_attention: {
    label: "Needs attention",
    tone: "warn",
    glyph: "◆",
    meaning: "Not yet off plan, but moving the wrong way or below standard.",
    rank: 4,
  },
  floor_breached: {
    label: "Floor breached",
    tone: "crit",
    glyph: "▼",
    meaning: "Below a floor the business has set. Shown red unless the approved reporting rule says amber.",
    rank: 6,
  },
  no_data: {
    label: "No data",
    tone: "neutral",
    glyph: "○",
    meaning: "Nothing loaded, or nothing comparable to judge against. No status is claimed.",
    rank: 0,
  },
};

const TONE_RANK: Record<StatusTone, number> = { neutral: 0, good: 1, warn: 2, crit: 3 };

export function statusMeta(status: KpiStatus): KpiStatusMeta {
  return KPI_STATUS_META[status];
}

export function statusLabel(status: KpiStatus): string {
  return KPI_STATUS_META[status].label;
}

export function statusTone(status: KpiStatus): StatusTone {
  return KPI_STATUS_META[status].tone;
}

/**
 * `under_budget` and `floor_breached` are the two statuses whose colour the
 * business rules may set. Callers that know the approved meaning pass it in;
 * everything else gets the documented default.
 */
export function statusToneWithRule(status: KpiStatus, rule?: StatusTone): StatusTone {
  if ((status === "under_budget" || status === "floor_breached") && rule) return rule;
  return statusTone(status);
}

/** The most severe tone in a set; neutral when the set is empty. */
export function worstTone(tones: readonly StatusTone[]): StatusTone {
  return tones.reduce<StatusTone>((worst, tone) => (TONE_RANK[tone] > TONE_RANK[worst] ? tone : worst), "neutral");
}

/** Existing RAG (initiative/pillar status) expressed in the shared vocabulary. */
export function ragToStatus(rag: "GREEN" | "AMBER" | "RED" | "GREY"): KpiStatus {
  switch (rag) {
    case "GREEN":
      return "ahead";
    case "AMBER":
      return "on_track";
    case "RED":
      return "behind";
    default:
      return "no_data";
  }
}

// ---------------------------------------------------------------------------
// Direction: higher-is-better vs lower-is-better
// ---------------------------------------------------------------------------

export type KpiDirection = "higher" | "lower";

export type DirectionReading = {
  direction: KpiDirection;
  /**
   * False when the name matched nothing. The default (higher) is only a display
   * fallback: unfavourable colouring is suppressed for unknown metrics rather
   * than guessing.
   */
  known: boolean;
};

// Direction rules are narrow on purpose. An earlier version matched broad
// substrings ("cost", "units", "days", "scores"), which misclassifies names that
// merely contain the word: "cost efficiency" is better when it rises, "units
// lost" is better when it falls, and "risk score" is a warning sign. So:
//
//   1. AMBIGUOUS names are recognised first and stay uncoloured. A name that
//      says both "churn" and "retention" has no single verdict.
//   2. COMPOUND identities come next, because the phrase fixes the meaning
//      regardless of the words inside it.
//   3. Then the two word-bounded lists, lower first: "unit churn" is churn.
//   4. Anything else is unknown, so a comparison for it stays neutral.
const AMBIGUOUS_DIRECTION = [
  // Both sides of the same coin in one name.
  /\b(churn|attrition)\b.*\bretention\b/,
  /\bretention\b.*\b(churn|attrition)\b/,
  // A variance with no stated measure, or a bare "change"/"gap": the sign tells
  // you nothing until the metric is named.
  /^(change|variance|gap|delta|growth|movement|difference)$/,
];

const COMPOUND_DIRECTION: { pattern: RegExp; direction: KpiDirection }[] = [
  // Fewer is better, whatever else the name says.
  { pattern: /\b(units?|owners?|deals?|customers?|guests?|accounts?|listings?|rooms?)\s+(lost|lost in)\b/, direction: "lower" },
  { pattern: /\brevenue\s+lost\b|\blost\s+revenue\b/, direction: "lower" },
  { pattern: /\brisk\s+(score|rating)\b|\bseverity\b/, direction: "lower" },
  { pattern: /\bdays?\s+(to|per)\b|\bcycle\s+time\b|\btime\s+to\b/, direction: "lower" },
  // More is better, whatever else the name says.
  { pattern: /\bcost\s+(efficiency|savings?|avoidance)\b/, direction: "higher" },
  { pattern: /\bexpense\s+(efficiency|savings?)\b/, direction: "higher" },
  { pattern: /\bspend\s+efficiency\b/, direction: "higher" },
];

const LOWER_IS_BETTER = [
  /\bchurn(s|ed|ing)?\b/,
  /\battrition\b/,
  /\bturnover\b/,
  /\bcac\b/,
  /\bcost per\b/,
  /\bcost of (sales|goods|revenue|service)\b/,
  /\bcosts?\b/,
  /\bopex\b/,
  /\bexpenses?\b/,
  /\bspend\b/,
  /\bvacanc(y|ies)\b/,
  /\bdelinquen\w*/,
  /\bcancellations?\b/,
  /\brefunds?\b/,
  /\bchargebacks?\b/,
  /\bwrite[- ]?offs?\b/,
  /\berrors?\b/,
  /\bincidents?\b/,
  /\bescalations?\b/,
  /\bfloors? breached\b/,
  /\bloss(es)?\b/,
  /\bleakage\b/,
  /\bbacklog\b/,
  /\bdowntime\b/,
];

const HIGHER_IS_BETTER = [
  /\bmargins?\b/,
  /\bebitda\b/,
  /\bnoi\b/,
  /\bgross profit\b/,
  /\bprofit(ability)?\b/,
  /\brevenue\b/,
  /\boccupanc(y|ies)\b/,
  /\bt?revpar\b/,
  /\badr\b/,
  /\bgbv\b/,
  /\btake rate\b/,
  /\bretention\b/,
  /\bsaves?\b/,
  /\bscores?\b/,
  /\badds?\b/,
  /\bdeals?\b/,
  /\bunits?\b/,
  /\bearnings?\b/,
  /\bbookings?\b/,
  /\breviews?\b/,
  /\bguests?\b/,
];

/**
 * Which way is better for a metric, from its human name. This is presentation
 * config, not business data: the name is a definition label, and the answer is
 * which direction to colour, never a value.
 */
export function metricDirection(name: string | null | undefined): DirectionReading {
  const text = (name ?? "").toLowerCase().trim();
  if (!text) return { direction: "higher", known: false };
  if (AMBIGUOUS_DIRECTION.some((pattern) => pattern.test(text))) return { direction: "higher", known: false };
  const compound = COMPOUND_DIRECTION.find((rule) => rule.pattern.test(text));
  if (compound) return { direction: compound.direction, known: true };
  if (LOWER_IS_BETTER.some((pattern) => pattern.test(text))) return { direction: "lower", known: true };
  if (HIGHER_IS_BETTER.some((pattern) => pattern.test(text))) return { direction: "higher", known: true };
  return { direction: "higher", known: false };
}

/**
 * The direction an approved mapping declares, when there is one. Explicit
 * metadata beats a name match: the mapping's `higherIsBetter` is the business's
 * own statement about the measure, so it is used as-is. Null means the caller
 * should fall back to `metricDirection`.
 */
export function measureDirection(higherIsBetter: boolean | null | undefined): DirectionReading | null {
  if (higherIsBetter == null) return null;
  return { direction: higherIsBetter ? "higher" : "lower", known: true };
}

/**
 * The direction to colour a measure with, preferring declared metadata.
 *
 * An approved measure mapping's `higherIsBetter` is the business's own statement
 * about the measure, so it wins. The name is only consulted when no mapping has
 * declared a direction, and a name that reads both ways still yields `known:
 * false` — which keeps the comparison neutral rather than guessing.
 */
export function resolveDirection(
  higherIsBetter: boolean | null | undefined,
  name: string | null | undefined,
): DirectionReading {
  return measureDirection(higherIsBetter) ?? metricDirection(name);
}

/**
 * Whether a delta (actual minus comparator) is good news. `null` when the delta
 * is zero or direction is unknown: neither favourable nor unfavourable.
 */
export function isFavorable(delta: number | null | undefined, reading: DirectionReading): boolean | null {
  if (delta == null || Number.isNaN(delta) || delta === 0) return null;
  if (!reading.known) return null;
  return reading.direction === "lower" ? delta < 0 : delta > 0;
}

/**
 * Whether a delta is good news, taking the sign of the values into account.
 *
 * Two conventions meet here, and they must not be mixed up:
 *
 * 1. A lower-is-better metric (churn, CAC, cost) improves as the raw number
 *    falls. But expenses are reported as negative numbers, so for those the
 *    magnitude — not the raw sign — is what "higher" means: cost of sales
 *    -15 against a budget of -13 is more spend (delta -2), which is worse.
 *    The comparator's sign tells us which convention applies.
 * 2. A higher-is-better metric always improves as the raw number rises, even
 *    when both values are negative. Adjusted EBITDA of -1.2 against a budget of
 *    -1.0 is a bigger loss (delta -0.2), which is worse — so the sign flip must
 *    not be applied here, or a miss would be painted green.
 */
export function favorableDelta(
  delta: number | null | undefined,
  comparator: number | null | undefined,
  reading: DirectionReading,
): boolean | null {
  if (delta == null || Number.isNaN(delta) || delta === 0) return null;
  if (!reading.known) return null;
  if (reading.direction === "higher") return delta > 0;
  // Lower-is-better: negative comparators are expenses, where less negative is
  // better; non-negative comparators follow the plain "falls is good" rule.
  return (comparator ?? 0) < 0 ? delta > 0 : delta < 0;
}

/** The text tone for a delta; null leaves it in normal ink. */
export function deltaTone(
  delta: number | null | undefined,
  reading: DirectionReading,
  comparator?: number | null,
): StatusTone | null {
  const favorable = favorableDelta(delta, comparator, reading);
  if (favorable === null) return null;
  return favorable ? "good" : "crit";
}

// ---------------------------------------------------------------------------
// Status from a comparison
// ---------------------------------------------------------------------------

export type Comparison = {
  actual: number | null;
  target: number | null;
  direction: KpiDirection;
  /**
   * Relative tolerance for "on goal", e.g. 0.1 for ±10%. Zero means the status
   * only reports ahead/behind, never on goal.
   */
  tolerance?: number;
};

/**
 * A deterministic status for a value against one target. When the tolerance is
 * met the result is `on_goal`; otherwise the direction decides ahead or behind.
 * Anything missing (either number, or a non-finite value) is `no_data`, never a
 * guess.
 */
export function statusFromComparison({ actual, target, direction, tolerance = 0 }: Comparison): KpiStatus {
  if (actual == null || target == null || !Number.isFinite(actual) || !Number.isFinite(target)) return "no_data";
  const gap = direction === "lower" ? actual - target : target - actual;
  const allowed = Math.abs(target) * Math.max(0, tolerance);
  if (gap <= allowed && gap >= -allowed) return "on_goal";
  return gap < 0 ? "ahead" : "behind";
}

// ---------------------------------------------------------------------------
// Mixed performance
// ---------------------------------------------------------------------------

export type StatusSummary = {
  total: number;
  /** Rows with a status other than no_data. */
  loaded: number;
  missing: number;
  ahead: number;
  onTrack: number;
  behind: number;
  /** Worst tone among the loaded rows. */
  tone: StatusTone;
  /** A short, factual chip label, e.g. "2 of 7 measures behind". */
  label: string;
};

/**
 * Summarise a set of measure statuses without flattening the nuance: the label
 * counts both sides when results are mixed, and names missing measures rather
 * than treating them as good news.
 */
export function summarizeStatuses(statuses: readonly KpiStatus[]): StatusSummary {
  const total = statuses.length;
  const missing = statuses.filter((status) => status === "no_data").length;
  const loadedStatuses = statuses.filter((status) => status !== "no_data");
  const ahead = loadedStatuses.filter((status) => status === "ahead").length;
  const onTrack = loadedStatuses.filter(
    (status) => status === "on_goal" || status === "on_track" || status === "needs_attention",
  ).length;
  const behind = loadedStatuses.length - ahead - onTrack;
  const tone = worstTone(loadedStatuses.map(statusTone));
  const loaded = loadedStatuses.length;

  let label: string;
  if (loaded === 0) {
    label = total === 0 ? "No measures" : `No measures loaded of ${total}`;
  } else if (ahead === loaded) {
    label = `All ${loaded} ${loaded === 1 ? "measure" : "measures"} ahead`;
  } else if (behind === 0) {
    label = `All ${loaded} ${loaded === 1 ? "measure" : "measures"} on or ahead of plan`;
  } else if (ahead === 0 && onTrack === 0) {
    label = `All ${loaded} ${loaded === 1 ? "measure" : "measures"} behind`;
  } else {
    label = `${behind} of ${loaded} ${loaded === 1 ? "measure" : "measures"} behind`;
  }
  if (missing > 0 && loaded > 0) label += ` · ${missing} not loaded`;

  return { total, loaded, missing, ahead, onTrack, behind, tone, label };
}

/** Mixed means at least one measure is behind while at least one is not. */
export function isMixed(summary: StatusSummary): boolean {
  return summary.loaded > 1 && summary.behind > 0 && summary.behind < summary.loaded;
}
