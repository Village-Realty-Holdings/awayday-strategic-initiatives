// Presentation shaping for the reviewed monthly report (no database access, so
// client components may import it). Every figure comes from KpiObservation; this
// module only decides which observation belongs in which slot, how it is
// labelled and how it is formatted. Nothing here contains a business value.
//
// Reporting populations are never mixed. A row is selected by its full identity
// (reportingScope + entityScope + timeBasis + comparisonBasis), and each table
// section names the population it belongs to.

import { formatDelta, formatMetricValue, metricKind, parseNumber, parseTargetNumber, type MetricKind } from "@/lib/review-format";

// Formatters live in review-format.ts so client components can use them without
// importing the Prisma-backed KPI module. Re-exported here for existing callers.
export { formatDelta, formatMetricValue, formatValueForKind, metricKind, parseNumber, parseTargetNumber, type MetricKind } from "@/lib/review-format";
import {
  comparePeriods,
  isCurrentObservation,
  observationIdentity,
  type KpiObservationRecord,
} from "@/lib/kpi";

export type ReportMetric = {
  id: string;
  metricKey: string;
  name: string;
  unit: string | null;
  displayFormat: string | null;
  target: string | null;
  strategicAreaId: string | null;
  /** StrategicArea.code of the linked area, when the definition is tied to one. */
  areaCode?: string | null;
  /**
   * Direction declared by an approved measure mapping, when this definition has
   * one. Explicit metadata: it is preferred over reading the name.
   */
  higherIsBetter?: boolean | null;
};

export type ReportObservation = KpiObservationRecord & { kpiId: string };

/** Prefix the reviewed-report ingestion uses for its definitions. */
export const REVIEWED_METRIC_PREFIX = "user_review:";

// ---------------------------------------------------------------------------
// Reporting populations
// ---------------------------------------------------------------------------

export type ReportScope = { reportingScope: string; entityScope: string };

export const BASE_BUSINESS_SCOPE: ReportScope = { reportingScope: "BASE_BUSINESS", entityScope: "BASE_BUSINESS" };
/** Finance-reported operating metrics. */
export const REPORTED_SCOPE: ReportScope = { reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" };

const SCOPE_LABELS: Record<string, string> = {
  "BASE_BUSINESS|BASE_BUSINESS": "Base Business",
  "USER_REVIEWED_REPORTED|REPORTED": "Finance reported",
  AWAYDAY_CONSOLIDATED: "Awayday consolidated",
  BASE_BUSINESS: "Base Business",
  USER_REVIEWED_REPORTED: "Finance reported",
  EX_OTA: "Ex-OTA",
  AWAYDNA_PMS: "AwayDNA PMS",
};

export function scopeKey(scope: ReportScope): string {
  return `${scope.reportingScope}|${scope.entityScope}`;
}

/** A human label for a population; unknown scopes stay visible rather than merging. */
export function scopeLabel(scope: ReportScope): string {
  return SCOPE_LABELS[scopeKey(scope)] ?? SCOPE_LABELS[scope.reportingScope] ?? scope.reportingScope.replace(/_/g, " ").toLowerCase();
}

/** Every distinct population present in a set of rows, in a stable order. */
export function scopesIn(rows: readonly ReportObservation[]): ReportScope[] {
  const seen = new Map<string, ReportScope>();
  for (const row of rows) {
    const scope = { reportingScope: row.reportingScope ?? "", entityScope: row.entityScope ?? "" };
    if (!scope.reportingScope) continue;
    seen.set(scopeKey(scope), scope);
  }
  return [...seen.values()].sort((a, b) => scopeKey(a).localeCompare(scopeKey(b)));
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * Whether `candidate` should replace `current` for the same identity. Mirrors the
 * KPI resolver's preference: authority first, then observation time, refresh
 * time and revision.
 *
 * Ranks are compared directly, never subtracted. A missing `authorityRank` is
 * the *weakest* rank (Infinity), so a populated rank always beats an unranked
 * row; only when both are unranked does recency decide. Subtracting two
 * Infinity values yields NaN and subtracting one yields ±Infinity, either of
 * which a finite-check would skip — that is exactly how a newer, less
 * authoritative row used to win an identity.
 */
export function isStrongerRow(candidate: ReportObservation, current: ReportObservation): boolean {
  const candidateRank = candidate.authorityRank ?? Number.POSITIVE_INFINITY;
  const currentRank = current.authorityRank ?? Number.POSITIVE_INFINITY;
  if (candidateRank !== currentRank) return candidateRank < currentRank;
  const observed = candidate.observedAt.getTime() - current.observedAt.getTime();
  if (observed !== 0) return observed > 0;
  const refreshed = (candidate.refreshedAt?.getTime() ?? 0) - (current.refreshedAt?.getTime() ?? 0);
  if (refreshed !== 0) return refreshed > 0;
  return (candidate.revision ?? 0) > (current.revision ?? 0);
}

/**
 * Today's approved row per identity for one month. Superseded, invalid and
 * unavailable rows are dropped; when two approved rows claim an identity the
 * stronger one wins, exactly as the KPI resolver decides elsewhere.
 */
export function currentPeriodRows(observations: readonly ReportObservation[], period: string): ReportObservation[] {
  const winners = new Map<string, ReportObservation>();
  for (const row of observations) {
    if (row.reportingPeriod !== period) continue;
    if (!isCurrentObservation(row)) continue;
    // The identity index covers period, basis, time, scope and entity but not the
    // metric: two different metrics legitimately share those, so key on both.
    const key = `${row.kpiId}\u0000${observationIdentity(row)}`;
    const existing = winners.get(key);
    if (!existing || isStrongerRow(row, existing)) winners.set(key, row);
  }
  return [...winners.values()];
}

/** The rows of one population, for metrics that describe the population itself (no entity split). */
export function rowsForScope(observations: readonly ReportObservation[], period: string, scope: ReportScope): ReportObservation[] {
  return currentPeriodRows(observations, period).filter(
    (row) => row.reportingScope === scope.reportingScope && (row.entityScope ?? "") === scope.entityScope && (row.entityId ?? null) === null,
  );
}

// ---------------------------------------------------------------------------
// Comparison table (month and YTD, actual and deltas)
// ---------------------------------------------------------------------------

export type ComparisonCell = {
  /** The formatted value, or null when nothing is loaded. */
  display: string | null;
  /** The numeric value, when it parsed. */
  value: number | null;
  /** The comparison value the delta was measured against, for a tooltip. */
  against?: number | null;
};

const EMPTY_CELL: ComparisonCell = { display: null, value: null };

export type ReportTableRow = {
  id: string;
  metricKey: string;
  label: string;
  kind: MetricKind;
  emphasis?: boolean;
  indent?: boolean;
  monthActual: ComparisonCell;
  monthVsBudget: ComparisonCell;
  monthVsPriorYear: ComparisonCell;
  ytdActual: ComparisonCell;
  ytdVsBudget: ComparisonCell;
  ytdVsPriorYear: ComparisonCell;
  target: string | null;
  /** Declared direction of this row's metric, when a mapping states one. */
  higherIsBetter?: boolean | null;
  /**
   * The metric identity a delta's direction is read from — the definition's name
   * plus its metric key. A table label is shortened for display ("Support % of
   * revenue"), so reading direction from the label lost the decisive word and
   * coloured a rise in a cost ratio green.
   */
  directionKey: string;
};

/** See `ReportTableRow.directionKey`: name and key words, never the display label. */
export function directionKeyFor(metric: Pick<ReportMetric, "name" | "metricKey">): string {
  const key = metric.metricKey.replace(/^[a-z_]+[:_]/i, "").replace(/[_:]+/g, " ");
  return `${metric.name} ${key}`.trim();
}

type Basis = "ACTUAL" | "BUDGET" | "PRIOR_YEAR";

function observationFor(rows: readonly ReportObservation[], kpiId: string, timeBasis: "MONTHLY" | "YTD", basis: Basis): ReportObservation | undefined {
  // Rows are already deduplicated per identity; a definition can still carry both
  // MONTHLY and YTD, which are different facts and must never stand in for each other.
  return rows.find((row) => row.kpiId === kpiId && (row.timeBasis ?? "YTD") === timeBasis && (row.comparisonBasis ?? "ACTUAL") === basis);
}

function cell(metric: ReportMetric, row: ReportObservation | undefined): ComparisonCell {
  if (!row) return EMPTY_CELL;
  const value = parseNumber(row.value);
  return { display: formatMetricValue(metric, value ?? row.value), value };
}

function deltaCell(kind: MetricKind, actual: ComparisonCell, against: ComparisonCell): ComparisonCell {
  if (actual.value == null || against.value == null) return EMPTY_CELL;
  const delta = actual.value - against.value;
  return { display: formatDelta(kind, delta), value: delta, against: against.value };
}

/** One table row per definition with any current value in this population. */
export function buildReportRows(metrics: readonly ReportMetric[], rows: readonly ReportObservation[]): ReportTableRow[] {
  const byKpi = new Map<string, ReportObservation[]>();
  for (const row of rows) byKpi.set(row.kpiId, [...(byKpi.get(row.kpiId) ?? []), row]);

  const built: ReportTableRow[] = [];
  for (const metric of metrics) {
    const own = byKpi.get(metric.id);
    if (!own || own.length === 0) continue;
    const kind = metricKind(metric);
    const monthActual = cell(metric, observationFor(own, metric.id, "MONTHLY", "ACTUAL"));
    const ytdActual = cell(metric, observationFor(own, metric.id, "YTD", "ACTUAL"));
    if (monthActual.value == null && ytdActual.value == null) {
      // Non-numeric values (a note, "n/a") are still shown as written, so the
      // section is honest about what the source said.
      if (!monthActual.display && !ytdActual.display) continue;
    }
    built.push({
      id: metric.metricKey,
      metricKey: metric.metricKey,
      label: metric.name,
      kind,
      monthActual,
      monthVsBudget: deltaCell(kind, monthActual, cell(metric, observationFor(own, metric.id, "MONTHLY", "BUDGET"))),
      monthVsPriorYear: deltaCell(kind, monthActual, cell(metric, observationFor(own, metric.id, "MONTHLY", "PRIOR_YEAR"))),
      ytdActual,
      ytdVsBudget: deltaCell(kind, ytdActual, cell(metric, observationFor(own, metric.id, "YTD", "BUDGET"))),
      ytdVsPriorYear: deltaCell(kind, ytdActual, cell(metric, observationFor(own, metric.id, "YTD", "PRIOR_YEAR"))),
      target: metric.target,
      higherIsBetter: metric.higherIsBetter,
      directionKey: directionKeyFor(metric),
    });
  }
  return built.sort((a, b) => a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------------------
// Line catalogues — presentation order and canonical labels, never values
// ---------------------------------------------------------------------------

export type LineSpec = { id: string; label: string; aliases: string[]; emphasis?: boolean };

function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9%+/]+/g, " ")
    .trim();
}

function lineScore(rowLabel: string, spec: LineSpec): number {
  const label = normalizeLabel(rowLabel);
  let best = 0;
  for (const alias of spec.aliases) {
    const a = normalizeLabel(alias);
    if (!a) continue;
    if (label === a) best = Math.max(best, 3);
    else if (label.startsWith(a)) best = Math.max(best, 2);
    else if (label.includes(a)) best = Math.max(best, 1);
  }
  return best;
}

/**
 * Orders rows as the reviewed report reads, and gives each its canonical label.
 * Rows the catalogue doesn't know keep their own name and follow alphabetically,
 * so a new metric is never hidden.
 */
export function orderByCatalogue(rows: readonly ReportTableRow[], catalogue: readonly LineSpec[]): ReportTableRow[] {
  // Best match wins globally, not in row order: an exact "Revenue" must claim the
  // Revenue line even when "Base Business Revenue" sorts first and matches weakly.
  const pairs: { row: ReportTableRow; spec: LineSpec; score: number }[] = [];
  for (const row of rows) {
    for (const spec of catalogue) {
      const score = lineScore(row.label, spec);
      if (score > 0) pairs.push({ row, spec, score });
    }
  }
  pairs.sort(
    (a, b) => b.score - a.score || catalogue.indexOf(a.spec) - catalogue.indexOf(b.spec) || a.row.label.localeCompare(b.row.label),
  );

  const assigned = new Map<string, { row: ReportTableRow; rank: number; spec: LineSpec }>();
  const usedRows = new Set<string>();
  for (const pair of pairs) {
    if (assigned.has(pair.spec.id) || usedRows.has(pair.row.id)) continue;
    assigned.set(pair.spec.id, { row: pair.row, rank: pair.score, spec: pair.spec });
    usedRows.add(pair.row.id);
  }
  const unmatched: ReportTableRow[] = rows.filter((row) => !usedRows.has(row.id));
  const ordered = catalogue
    .filter((spec) => assigned.has(spec.id))
    .map((spec) => {
      const { row } = assigned.get(spec.id)!;
      return { ...row, label: spec.label, emphasis: spec.emphasis ?? row.emphasis };
    });
  return [...ordered, ...unmatched.sort((a, b) => a.label.localeCompare(b.label))];
}

/** The Base Business P&L lines, in the order Finance reports them. */
export const BASE_BUSINESS_LINES: LineSpec[] = [
  { id: "revenue", label: "Revenue", aliases: ["revenue", "total revenue", "base business revenue"] },
  { id: "cost-of-sales", label: "Cost of sales", aliases: ["cost of sales", "cost of revenue", "cost of goods sold", "cogs"] },
  { id: "shop-opex", label: "Shop opex", aliases: ["shop opex", "shop operating expenses", "shop operating expense"] },
  { id: "shop-noi", label: "Shop NOI", aliases: ["shop noi", "shop net operating income"], emphasis: true },
  { id: "supportco", label: "SupportCo", aliases: ["supportco", "support co", "support company", "support costs", "support cost"], emphasis: false },
  { id: "business-development", label: "Business development", aliases: ["business development", "bd expense", "business development expense"] },
  { id: "interest-income", label: "Interest income", aliases: ["interest income"] },
  { id: "adjusted-ebitda", label: "Adj. EBITDA", aliases: ["adjusted ebitda", "adj ebitda"], emphasis: true },
  { id: "shop-noi-margin", label: "Shop NOI margin (reported basis)", aliases: ["shop noi margin reported basis", "shop noi margin reported", "shop noi margin"] },
  { id: "shop-noi-margin-ex-ota", label: "Shop NOI margin (ex-OTA basis)", aliases: ["shop noi margin ex ota basis", "shop noi margin ex ota", "shop noi margin excluding ota"] },
  { id: "support-cost-pct", label: "Support % of revenue", aliases: ["support cost as % of revenue", "support cost percentage", "support cost as percentage of revenue", "support costs as % of revenue"] },
];

// ---------------------------------------------------------------------------
// Operating KPI families
// ---------------------------------------------------------------------------

export type MetricGroup = { id: string; label: string; match: RegExp };

/** The reviewed report's operating sections. First match wins; "other" catches the rest. */
export const OPERATING_GROUPS: MetricGroup[] = [
  { id: "trevpar", label: "TRevPAR", match: /trevpar/i },
  { id: "rate", label: "Rate, occupancy and fees", match: /\badr\b|occupancy|other fees|per night/i },
  { id: "booking", label: "Booking value and take rate", match: /gross booking value|\bgbv\b|take rate/i },
  { id: "units", label: "Unit adds and inventory", match: /unit adds?|bookable units|ending units|average units|units acquired/i },
  { id: "churn", label: "Owner retention, churn and CAC", match: /churn|\bcac\b|cost to acquire/i },
  { id: "margin", label: "Margins", match: /margin/i },
  { id: "ma", label: "M&A pipeline", match: /multiple|\bloi\b|tuck-in|deals? closed|acquired ebitda|offers?/i },
  { id: "guest", label: "Guest experience", match: /review|guest satisf/i },
  { id: "other", label: "Other reviewed metrics", match: /.*/ },
];

export function groupReportRows(rows: readonly ReportTableRow[], groups: readonly MetricGroup[] = OPERATING_GROUPS): { id: string; label: string; rows: ReportTableRow[] }[] {
  const buckets = new Map<string, ReportTableRow[]>();
  for (const row of rows) {
    const group = groups.find((g) => g.match.test(row.label)) ?? groups[groups.length - 1];
    buckets.set(group.id, [...(buckets.get(group.id) ?? []), row]);
  }
  return groups
    .filter((g) => buckets.has(g.id))
    .map((g) => ({ id: g.id, label: g.label, rows: buckets.get(g.id)! }));
}

// ---------------------------------------------------------------------------
// Executive summary cards
// ---------------------------------------------------------------------------

export type ExecCardSpec = {
  id: string;
  title: string;
  /** Printed when nothing matches, so the gap names the exact identity needed. */
  expected: string;
  timeBasis: "MONTHLY" | "YTD" | "LTM";
  /** The population the card is about, or null when the report labels it without one. */
  scope: ReportScope | null;
  match: (metric: ReportMetric) => boolean;
};

function haystack(metric: ReportMetric): string {
  return `${metric.metricKey} ${metric.name}`.toLowerCase().replace(/user_review[:_]/g, " ").replace(/[_]+/g, " ");
}

function hasAdjustedEbitda(metric: ReportMetric): boolean {
  return /adjusted ebitda/.test(haystack(metric)) && !/lender|pro ?forma|margin/.test(haystack(metric));
}

export const EXEC_CARD_SPECS: ExecCardSpec[] = [
  {
    id: "month-adjusted-ebitda",
    title: "Oct Adj. EBITDA (base business)",
    expected: "Monthly actual · Adjusted EBITDA · Base Business",
    timeBasis: "MONTHLY",
    scope: BASE_BUSINESS_SCOPE,
    match: hasAdjustedEbitda,
  },
  {
    id: "ytd-adjusted-ebitda",
    title: "YTD Adj. EBITDA",
    expected: "YTD actual · Adjusted EBITDA · Base Business",
    timeBasis: "YTD",
    scope: BASE_BUSINESS_SCOPE,
    match: hasAdjustedEbitda,
  },
  {
    id: "ltm-lender-ebitda",
    title: "LTM PF Lender EBITDA",
    expected: "LTM actual · Pro Forma Lender EBITDA",
    timeBasis: "LTM",
    scope: null,
    match: (metric) => /lender|pro ?forma/.test(haystack(metric)) && /ebitda/.test(haystack(metric)),
  },
  {
    id: "month-shop-noi",
    title: "Oct Shop NOI",
    expected: "Monthly actual · Shop NOI · Base Business",
    timeBasis: "MONTHLY",
    scope: BASE_BUSINESS_SCOPE,
    match: (metric) => /shop noi/.test(haystack(metric)) && !/margin|%|percent/.test(haystack(metric)),
  },
];

export type ExecCard = {
  id: string;
  title: string;
  scopeLabel: string;
  expected: string;
  /** The definition and basis the card read, so a chart can refuse to reuse it. */
  metricId: string | null;
  timeBasis: string | null;
  metricName: string | null;
  /** Declared direction of the card's metric, when a mapping states one. */
  higherIsBetter?: boolean | null;
  value: string | null;
  delta: ComparisonCell;
  deltaLabel: string;
  basisLabel: string;
};

const BASIS_LABEL: Record<ExecCardSpec["timeBasis"], string> = { MONTHLY: "Month", YTD: "YTD", LTM: "LTM" };

/**
 * How a row's time basis is shown. A row with no declared basis reads as YTD,
 * the application's default basis (see `DEFAULT_TIME_BASIS` in kpi.ts) and the
 * same assumption the reviewed P&L table makes, so one observation cannot be
 * YTD in one table and missing in the next.
 */
export function timeBasisLabel(value: string | null | undefined): string {
  const basis = value ?? "YTD";
  return BASIS_LABEL[basis as ExecCardSpec["timeBasis"]] ?? (basis === "POINT_IN_TIME" ? "Point in time" : basis === "TTM" ? "TTM" : basis);
}

function pickMetric(
  metrics: readonly ReportMetric[],
  rows: readonly ReportObservation[],
  spec: ExecCardSpec,
): { metric: ReportMetric; row: ReportObservation } | null {
  const candidates = metrics
    .filter(spec.match)
    .filter((metric) => rows.some((row) => row.kpiId === metric.id && (row.timeBasis ?? "YTD") === spec.timeBasis && (row.comparisonBasis ?? "ACTUAL") === "ACTUAL"))
    .sort((a, b) => a.name.length - b.name.length || a.metricKey.localeCompare(b.metricKey));
  if (candidates.length === 0) return null;

  const scoped = (metric: ReportMetric, scope: ReportScope | null) =>
    rows.find(
      (row) =>
        row.kpiId === metric.id &&
        (row.timeBasis ?? "YTD") === spec.timeBasis &&
        (row.comparisonBasis ?? "ACTUAL") === "ACTUAL" &&
        (scope === null || (row.reportingScope === scope.reportingScope && (row.entityScope ?? "") === scope.entityScope)) &&
        (row.entityId ?? null) === null,
    );

  for (const metric of candidates) {
    const row = scoped(metric, spec.scope);
    if (row) return { metric, row };
  }
  return null;
}

/**
 * The four headline cards. A card with no matching observation renders its
 * expected identity instead of a number; no figure is inferred or carried over
 * from another population.
 */
export function buildExecCards(metrics: readonly ReportMetric[], rows: readonly ReportObservation[], period: string): ExecCard[] {
  const periodRows = currentPeriodRows(rows, period).filter((row) => (row.entityId ?? null) === null);
  return EXEC_CARD_SPECS.map((spec) => {
    const found = pickMetric(metrics, periodRows, spec);
    if (!found) {
      return {
        id: spec.id,
        title: spec.title,
        scopeLabel: spec.scope ? scopeLabel(spec.scope) : "Not loaded",
        expected: spec.expected,
        metricId: null,
        timeBasis: null,
        metricName: null,
        value: null,
        delta: EMPTY_CELL,
        deltaLabel: "no comparison loaded",
        basisLabel: BASIS_LABEL[spec.timeBasis],
      };
    }
    const { metric, row } = found;
    const foundScope = { reportingScope: row.reportingScope ?? "", entityScope: row.entityScope ?? "" };
    const actual = cell(metric, row);
    const kind = metricKind(metric);

    // Budget first, as Finance reads it; prior year only when no budget figure exists.
    for (const basis of ["BUDGET", "PRIOR_YEAR"] as const) {
      const comparison = periodRows.find(
        (candidate) =>
          candidate.kpiId === metric.id &&
          (candidate.timeBasis ?? "YTD") === spec.timeBasis &&
          (candidate.comparisonBasis ?? "ACTUAL") === basis &&
          candidate.reportingScope === row.reportingScope &&
          (candidate.entityScope ?? "") === (row.entityScope ?? ""),
      );
      if (comparison) {
        return {
          id: spec.id,
          title: spec.title,
          scopeLabel: scopeLabel(foundScope),
          expected: spec.expected,
          metricId: metric.id,
          timeBasis: spec.timeBasis,
          metricName: metric.name,
          higherIsBetter: metric.higherIsBetter,
          value: actual.display,
          delta: deltaCell(kind, actual, cell(metric, comparison)),
          deltaLabel: basis === "BUDGET" ? "vs budget" : "vs prior year",
          basisLabel: BASIS_LABEL[spec.timeBasis],
        };
      }
    }

    return {
      id: spec.id,
      title: spec.title,
      scopeLabel: scopeLabel(foundScope),
      expected: spec.expected,
      metricId: metric.id,
      timeBasis: spec.timeBasis,
      metricName: metric.name,
      higherIsBetter: metric.higherIsBetter,
      value: actual.display,
      delta: EMPTY_CELL,
      deltaLabel: "no comparison loaded",
      basisLabel: BASIS_LABEL[spec.timeBasis],
    };
  });
}

// ---------------------------------------------------------------------------
// Pillar scorecards
// ---------------------------------------------------------------------------

export type MetricExpectation = { label: string; match: RegExp };

/**
 * The reviewed report's scorecard lines per area code. These are metric
 * identities (labels and matching rules), not values: a line appears with its
 * observation when the definition exists, otherwise it is listed as expected
 * and not loaded.
 */
export const PILLAR_EXPECTATIONS: Record<string, MetricExpectation[]> = {
  "M&A": [
    { label: "Acquired EBITDA closed", match: /acquired ebitda/i },
    { label: "Tuck-in EBITDA", match: /tuck.?in ebitda/i },
    { label: "Deals closed", match: /deals? closed/i },
    { label: "Tuck-in deals", match: /tuck.?in deals?/i },
    { label: "Units acquired", match: /units acquired/i },
    { label: "Total multiple paid", match: /total multiple/i },
    { label: "Synergized multiple paid", match: /synergi[sz]ed multiple/i },
    { label: "Active LOI pipeline", match: /\bloi\b/i },
    { label: "Submitted offers", match: /submitted offers?/i },
    { label: "Median tuck-in cycle time", match: /tuck.?in.*cycle|cycle.*tuck.?in/i },
  ],
  GROW: [
    { label: "BD unit adds", match: /\bbd\b.*unit adds?|unit adds?.*\bbd\b/i },
    { label: "Finance unit adds", match: /finance.*unit adds?|unit adds?.*finance/i },
    { label: "Organic unit adds", match: /organic.*unit adds?|unit adds?.*organic/i },
    { label: "Net unit adds", match: /net.*unit adds?|unit adds?.*net/i },
    { label: "BD saves", match: /\bbd\b saves?|saves?.*\bbd\b/i },
    { label: "Ending units", match: /ending units/i },
    { label: "Cash CAC", match: /cash cac|\bcac\b/i },
  ],
  RETENTION: [
    { label: "Annualized unit churn", match: /annuali[sz]ed.*churn/i },
    { label: "TTM unit churn", match: /\bttm\b.*churn|\bltm\b.*churn/i },
    { label: "Units churned", match: /churned units|units churned/i },
    { label: "Shop-at-fault churn", match: /shop.?at.?fault/i },
    { label: "AwayDNA churn", match: /awaydna.*churn|churn.*awaydna/i },
    { label: "Bookable units", match: /bookable units/i },
  ],
  // Most specific first: a generic line must not consume the row that a
  // narrower line describes.
  TREVPAR: [
    { label: "TRevPAR ex-OTA", match: /trevpar.*ex.?ota|ex.?ota.*trevpar/i },
    { label: "TRevPAR AwayDNA PMS", match: /trevpar.*awaydna|awaydna.*trevpar/i },
    { label: "TRevPAR growth vs prior year", match: /trevpar growth/i },
    { label: "TRevPAR reported", match: /trevpar/i },
    { label: "ADR", match: /\badr\b/i },
    { label: "Paid occupancy", match: /occupancy/i },
    { label: "Other fees per night", match: /other fees/i },
  ],
  MARGIN: [
    { label: "Shop NOI margin (ex-OTA)", match: /shop noi margin.*ex.?ota/i },
    { label: "Shop NOI margin (reported)", match: /shop noi margin/i },
    { label: "Adjusted EBITDA margin", match: /adjusted ebitda margin/i },
    { label: "Support cost %", match: /support cost/i },
    { label: "Cost-of-sales labor %", match: /cost of sales.*labo|labo.*cost of sales/i },
    { label: "Cleaning margin", match: /cleaning margin/i },
    { label: "Maintenance margin", match: /maintenance margin/i },
    { label: "OTA margin", match: /\bota\b.*margin|margin.*\bota\b/i },
  ],
  GUEST: [
    { label: "Average review score", match: /review score/i },
    { label: "Reviews received", match: /reviews received/i },
    { label: "TTM review score", match: /\bttm\b.*review|\bltm\b.*review/i },
    { label: "Brands below review-score threshold", match: /below.*threshold|threshold.*below/i },
    { label: "Guest satisfaction score", match: /guest satisf/i },
  ],
  TALENT: [{ label: "Properties per FTE", match: /properties per fte/i }],
  TECH: [{ label: "Properties per FTE in use-case functions", match: /properties per fte|tool adoption/i }],
  MARKETING: [{ label: "Direct GBV growth (YoY)", match: /direct.*gbv.*growth|gbv.*growth/i }],
  FINANCE: [{ label: "Accounting close cycle time", match: /accounting close|close cycle/i }],
};

export type ScorecardRow = {
  id: string;
  label: string;
  kind: MetricKind;
  /** True when this is a documented expectation with no definition or value yet. */
  expectedOnly: boolean;
  value: string | null;
  /** The time basis `value` was read on, so a fallback row is never mislabelled. */
  basisLabel: string;
  /** The population `value` came from; shown when one card holds more than one. */
  scopeLabel: string;
  delta: ComparisonCell;
  deltaLabel: string;
  target: string | null;
  status: "ahead" | "on_track" | "behind" | "no_data";
  metricName: string | null;
};

export type PillarScorecard = {
  rows: ScorecardRow[];
  /** Expectations with no definition or observation, listed rather than hidden. */
  expectedMissing: number;
  /** Definitions linked to the area that have a value this month. */
  loaded: number;
  scopeLabels: string[];
  totalMetrics: number;
};

const STATUS_LABEL: Record<ScorecardRow["status"], string> = { ahead: "Ahead", on_track: "On track", behind: "Behind", no_data: "No data" };

export function scorecardStatusLabel(status: ScorecardRow["status"]): string {
  return STATUS_LABEL[status];
}

/**
 * Status of a value against a definition's target, in the target's own unit.
 * Amber within 10% of the target on either side, matching the app's other
 * target comparisons; no status when either side is missing or not a single
 * comparable figure.
 */
export function statusAgainstTarget(value: string | null | undefined, target: string | null | undefined): ScorecardRow["status"] {
  const actual = parseNumber(value ?? null);
  const parsed = parseTargetNumber(target);
  if (actual === null || parsed === null) return "no_data";
  if (Math.abs(actual - parsed.value) <= Math.abs(parsed.value) * 0.1) return "on_track";
  const better = parsed.lowerIsBetter ? actual < parsed.value : actual > parsed.value;
  return better ? "ahead" : "behind";
}

/**
 * The detailed scorecard for one area: every KPI definition linked to it, plus
 * the report's expected lines that have no definition yet. Values are read for
 * the review month; comparisons use the same population as the value itself.
 */
export function buildPillarScorecard(
  area: { id: string | null; code: string; name: string },
  metrics: readonly ReportMetric[],
  observations: readonly ReportObservation[],
  period: string,
): PillarScorecard {
  const periodRows = currentPeriodRows(observations, period).filter((row) => (row.entityId ?? null) === null);
  const expectations = PILLAR_EXPECTATIONS[area.code.toUpperCase()] ?? PILLAR_EXPECTATIONS[area.code] ?? [];

  // A metric belongs to this scorecard when the definition is linked to the area.
  // A reviewed-report metric that is linked to no area at all is attributed by the
  // expectation it matches, so the scorecard still appears before anyone curates
  // the links. A metric linked to another area is never re-attributed.
  const linked = metrics.filter((metric) => (area.id ? metric.strategicAreaId === area.id : false));
  const linkedIds = new Set(linked.map((metric) => metric.id));
  const byExpectation = metrics.filter(
    (metric) => !linkedIds.has(metric.id) && metric.strategicAreaId == null && expectations.some((expectation) => expectation.match.test(metric.name)),
  );
  const candidates = [...linked, ...byExpectation];
  const scopes = new Set<string>();

  const built = candidates
    .map((metric): ScorecardRow | null => {
      // Sorted by population, then basis, so a definition that publishes under two
      // scopes resolves the same way on every render instead of following row order.
      const own = periodRows
        .filter((row) => row.kpiId === metric.id)
        .sort(
          (a, b) =>
            scopeKey({ reportingScope: a.reportingScope ?? "", entityScope: a.entityScope ?? "" }).localeCompare(
              scopeKey({ reportingScope: b.reportingScope ?? "", entityScope: b.entityScope ?? "" }),
            ) || (a.timeBasis ?? "").localeCompare(b.timeBasis ?? ""),
        );
      if (own.length === 0) return null;
      const scope = { reportingScope: own[0].reportingScope ?? "", entityScope: own[0].entityScope ?? "" };
      for (const row of own) scopes.add(scopeLabel({ reportingScope: row.reportingScope ?? "", entityScope: row.entityScope ?? "" }));
      const kind = metricKind(metric);
      const actualRow = own.find((row) => (row.timeBasis ?? "YTD") === "MONTHLY" && (row.comparisonBasis ?? "ACTUAL") === "ACTUAL") ?? own.find((row) => (row.comparisonBasis ?? "ACTUAL") === "ACTUAL");
      const actual = cell(metric, actualRow);
      const budget = actualRow
        ? own.find((row) => row.reportingScope === actualRow.reportingScope && (row.entityScope ?? "") === (actualRow.entityScope ?? "") && (row.timeBasis ?? "YTD") === (actualRow.timeBasis ?? "YTD") && row.comparisonBasis === "BUDGET")
        : undefined;
      const prior = actualRow
        ? own.find((row) => row.reportingScope === actualRow.reportingScope && (row.entityScope ?? "") === (actualRow.entityScope ?? "") && (row.timeBasis ?? "YTD") === (actualRow.timeBasis ?? "YTD") && row.comparisonBasis === "PRIOR_YEAR")
        : undefined;
      const delta = budget ? { cell: deltaCell(kind, actual, cell(metric, budget)), label: "vs budget" } : prior ? { cell: deltaCell(kind, actual, cell(metric, prior)), label: "vs prior year" } : null;
      const rowScope = actualRow
        ? scopeLabel({ reportingScope: actualRow.reportingScope ?? "", entityScope: actualRow.entityScope ?? "" })
        : scopeLabel(scope);
      return {
        id: metric.metricKey,
        label: metric.name,
        kind,
        expectedOnly: false,
        value: actual.display,
        basisLabel: timeBasisLabel(actualRow?.timeBasis),
        scopeLabel: rowScope,
        delta: delta?.cell ?? EMPTY_CELL,
        deltaLabel: delta?.label ?? "no comparison loaded",
        target: metric.target,
        status: statusAgainstTarget(actualRow?.value ?? null, metric.target ?? null),
        metricName: metric.name,
      } satisfies ScorecardRow;
    });
  const rows: ScorecardRow[] = built.filter((row): row is ScorecardRow => row !== null);

  // Each expected line claims at most one loaded row, most specific first, so a
  // narrow line (TRevPAR ex-OTA) is not reported as missing because a broad one
  // (TRevPAR) matched the same metric.
  const covered = new Set<number>();
  const claimed = new Set<string>();
  for (const [index, expectation] of expectations.entries()) {
    const row = rows.find((candidate) => !claimed.has(candidate.id) && expectation.match.test(candidate.label));
    if (row) {
      claimed.add(row.id);
      covered.add(index);
    }
  }
  const missing: ScorecardRow[] = expectations
    .map((expectation, index) => ({ expectation, index }))
    .filter(({ index }) => !covered.has(index))
    .map(({ expectation }) => ({
      id: `expected:${area.code}:${expectation.label}`,
      label: expectation.label,
      kind: "number" as MetricKind,
      expectedOnly: true,
      value: null,
      basisLabel: "",
      scopeLabel: "",
      delta: EMPTY_CELL,
      deltaLabel: "no definition linked",
      target: null,
      status: "no_data" as const,
      metricName: null,
    }));

  return {
    rows: [...rows, ...missing],
    expectedMissing: missing.length,
    loaded: rows.length,
    scopeLabels: [...scopes].sort(),
    totalMetrics: candidates.length,
  };
}

// ---------------------------------------------------------------------------
// Historical series
// ---------------------------------------------------------------------------

export type TrendSeriesSpec = {
  key: string;
  label: string;
  match: (metric: ReportMetric) => boolean;
  /**
   * The time basis the reviewed report states for this series, or null when it
   * states none. A null basis is never guessed: the series resolves only from a
   * definition that is not the headline's, and the basis it declares is shown.
   */
  timeBasis: string | null;
  /**
   * Never read an identity a headline card uses. The reviewed chart's October
   * point is a different number from the October YTD headline, so reusing that
   * identity would plot the wrong fact. A different basis of the same definition
   * is still eligible: it is a published row in its own right.
   */
  excludeHeadline?: boolean;
  /** The reviewed chart draws this series dashed. */
  style?: "solid" | "dashed";
  /** Preferred population; null accepts whichever population publishes the series. */
  scope: ReportScope | null;
  /** What the review needs when this series cannot be drawn. */
  missing: string;
};

export type TrendChartSpec = {
  id: string;
  title: string;
  description: string;
  series: TrendSeriesSpec[];
};

export type TrendPoint = { period: string; value: number; restated: boolean };
export type TrendSeries = {
  key: string;
  label: string;
  metricName: string;
  scopeLabel: string;
  kind: MetricKind;
  /** The reviewed chart draws the Base Business line dashed. */
  style: "solid" | "dashed";
  points: TrendPoint[];
};
export type TrendChart = {
  id: string;
  title: string;
  description: string;
  series: TrendSeries[];
  periods: string[];
  /** The time basis each drawn series actually reads, for the caption. */
  basisLabels: string[];
  /** What is missing, in the review's own terms, for any series it could not draw. */
  notes: string[];
};

export const TREND_CHART_SPECS: TrendChartSpec[] = [
  {
    id: "ltm-ebitda",
    title: "LTM Pro Forma Lender EBITDA",
    description:
      "The lender view of trailing EBITDA (solid), against Base Business Adjusted EBITDA (dashed) for the same months. Each series is one time basis and one population: the two are never converted into one another. The reviewed report states LTM only for the lender line.",
    series: [
      // The reviewed chart heading states LTM for the lender line.
      {
        key: "lender",
        label: "LTM Pro Forma Lender EBITDA",
        match: (metric) => /lender|pro ?forma/.test(haystack(metric)) && /ebitda/.test(haystack(metric)),
        timeBasis: "LTM",
        scope: null,
        missing: "LTM actual · LTM Pro Forma Lender EBITDA, one observation per month.",
      },
      // The reviewed chart draws this line dashed and calls it "Base business Adj.
      // EBITDA". It does not state an accounting basis, and its October point
      // ($77.3M) is not the October YTD headline ($79.9M), so the headline's
      // identity is excluded rather than assumed to be the same series.
      {
        key: "base-business",
        label: "Base Business Adjusted EBITDA",
        match: hasAdjustedEbitda,
        timeBasis: null,
        excludeHeadline: true,
        style: "dashed",
        scope: BASE_BUSINESS_SCOPE,
        missing:
          "Base Business Adjusted EBITDA on the rolling basis the review plots. The reviewed report does not state that series' accounting basis, and its October point differs from the October YTD headline, so the YTD identity is deliberately not used. Publish the chart series as its own definition with a declared time basis.",
      },
    ],
  },
  {
    id: "awaydna-trevpar",
    title: "AwayDNA TRevPAR",
    description: "TRevPAR for the AwayDNA PMS population, month by month.",
    series: [
      {
        // "TRevPAR by month, Aug-25 to Oct-26 (AwayDNA, PMS basis)" — monthly.
        key: "awaydna",
        label: "AwayDNA PMS TRevPAR",
        match: (metric) => /trevpar/.test(haystack(metric)) && /awaydna/.test(haystack(metric)),
        timeBasis: "MONTHLY",
        scope: null,
        missing: "Monthly actual · AwayDNA PMS TRevPAR, one observation per month, August 2025 – October 2026.",
      },
    ],
  },
];

type TrendResolution = { series: TrendSeries; basisLabel: string } | { series: null; note: string };

/**
 * Resolves one series. A confirmed basis is used as stated. When the reviewed
 * report states no basis (the dashed Base Business line), the series is resolved
 * only from a definition that is not the headline card's: the review's October
 * point and its October YTD headline are different numbers, so reusing the
 * headline identity would plot the wrong fact. No basis is inferred, and an
 * ambiguous set of candidates yields no line plus a note rather than a guess.
 */
function seriesFor(
  spec: TrendSeriesSpec,
  metrics: readonly ReportMetric[],
  observations: readonly ReportObservation[],
  headlineIdentities: ReadonlySet<string> = new Set(),
): TrendResolution {
  const candidates = metrics.filter(spec.match);
  if (candidates.length === 0) return { series: null, note: spec.missing };

  type Candidate = { metric: ReportMetric; scope: ReportScope; basis: string; rows: ReportObservation[] };
  const groups = new Map<string, Candidate>();

  for (const metric of candidates) {
    const eligible = observations.filter(
      (row) =>
        isCurrentObservation(row) &&
        row.kpiId === metric.id &&
        (row.comparisonBasis ?? "ACTUAL") === "ACTUAL" &&
        (row.entityId ?? null) === null &&
        // A series reads one explicit basis only; a row that names none is not a series.
        (row.timeBasis ?? null) !== null &&
        (spec.timeBasis === null || row.timeBasis === spec.timeBasis) &&
        !(spec.excludeHeadline && headlineIdentities.has(`${row.kpiId}\u0000${row.timeBasis ?? ""}`)),
    );

    // One series is one population. Rows from different populations are grouped
    // first and never merged into one line.
    for (const row of eligible) {
      const scope = { reportingScope: row.reportingScope ?? "", entityScope: row.entityScope ?? "" };
      if (spec.scope !== null && (scope.reportingScope !== spec.scope.reportingScope || scope.entityScope !== spec.scope.entityScope)) continue;
      const key = `${scopeKey(scope)}\u0000${metric.id}\u0000${row.timeBasis}`;
      const entry = groups.get(key) ?? { metric, scope, basis: row.timeBasis ?? "", rows: [] };
      entry.rows.push(row);
      groups.set(key, entry);
    }
  }

  if (groups.size === 0) return { series: null, note: spec.missing };
  if (groups.size > 1) {
    // More than one published identity could be this line: report them instead of
    // choosing one that the review did not choose.
    const found = [...groups.values()]
      .map((group) => `${group.metric.name} (${group.basis}${group.rows.length ? `, ${group.rows.length} month${group.rows.length === 1 ? "" : "s"}` : ""})`)
      .sort()
      .join("; ");
    return { series: null, note: `${spec.missing} More than one published identity matches, so none is plotted: ${found}.` };
  }

  const best = [...groups.values()][0];
  const byPeriod = new Map<string, ReportObservation>();
  for (const row of best.rows) {
    const existing = byPeriod.get(row.reportingPeriod);
    if (!existing || isStrongerRow(row, existing)) byPeriod.set(row.reportingPeriod, row);
  }

  const points: TrendPoint[] = [...byPeriod.values()]
    .map((row) => ({ period: row.reportingPeriod, value: parseNumber(row.value), restated: (row.revision ?? 1) > 1 }))
    .filter((point): point is TrendPoint => point.value !== null)
    .sort((a, b) => comparePeriods(a.period, b.period));

  if (points.length === 0) return { series: null, note: spec.missing };

  return {
    series: {
      key: spec.key,
      label: spec.label,
      metricName: best.metric.name,
      scopeLabel: scopeLabel(best.scope),
      kind: metricKind(best.metric),
      style: spec.style ?? "solid",
      points,
    },
    basisLabel: best.basis,
  };
}

/** The next calendar month after a period. */
function nextPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

/**
 * A contiguous month axis from the first to the last observed month. Months with
 * no observation stay on the axis as gaps, so the chart never spaces July next to
 * September or draws a line through a month nobody published. The guard keeps a
 * malformed period from generating an unbounded axis.
 */
function contiguousPeriods(observed: readonly string[]): string[] {
  if (observed.length === 0) return [];
  const first = observed[0];
  const last = observed[observed.length - 1];
  const axis = [first];
  while (axis[axis.length - 1] !== last && axis.length < 600) axis.push(nextPeriod(axis[axis.length - 1]));
  return axis;
}

export function buildTrendChart(
  spec: TrendChartSpec,
  metrics: readonly ReportMetric[],
  observations: readonly ReportObservation[],
  options: { headlineIdentities?: ReadonlySet<string> } = {},
): TrendChart {
  const resolutions = spec.series.map((s) => ({ spec: s, result: seriesFor(s, metrics, observations, options.headlineIdentities) }));
  const series = resolutions.map((r) => r.result.series).filter((s): s is TrendSeries => s !== null);
  const basisLabels = resolutions
    .map((r) => r.result.series && "basisLabel" in r.result ? `${r.spec.label}: ${r.result.basisLabel}` : null)
    .filter((label): label is string => label !== null);
  const notes = resolutions.map((r) => (r.result.series === null ? r.result.note : null)).filter((note): note is string => note !== null);
  const periods = contiguousPeriods([...new Set(series.flatMap((s) => s.points.map((p) => p.period)))].sort(comparePeriods));
  return { id: spec.id, title: spec.title, description: spec.description, series, periods, basisLabels, notes };
}

// ---------------------------------------------------------------------------
// Brand-level churn
// ---------------------------------------------------------------------------

export type BrandChurnColumn = {
  key: "bookableUnits" | "monthChurned" | "monthAnnualizedPct" | "ltmChurned" | "ltmPct";
  label: string;
  match: RegExp;
  kind: MetricKind;
  count: boolean;
  /** Display order, left to right. */
  order: number;
  /**
   * The time bases this column may read. A row published on another basis is a
   * different fact, so it never fills this column and never overwrites a value
   * that did.
   */
  bases: readonly string[];
};

/**
 * The reviewed churn table's columns. A brand is any observation carrying an
 * entityId; its rows are matched to a column by metric name, so the list of
 * brands never lives in source. Matching is most-specific-first (LTM lines
 * before the single-month lines) so "LTM churned units" is never read as the
 * month's churn.
 */
/** Trailing-period bases. LTM and TTM are the same window under two names. */
const TRAILING_BASES = ["LTM", "TTM"] as const;

export const BRAND_CHURN_COLUMNS: BrandChurnColumn[] = [
  { key: "ltmPct", label: "LTM churn %", match: /\b(ltm|ttm)\b.*churn.*(%|percent|rate)|churn.*(%|percent|rate).*\b(ltm|ttm)\b/i, kind: "percent", count: false, order: 5, bases: TRAILING_BASES },
  { key: "ltmChurned", label: "LTM churned units", match: /\b(ltm|ttm)\b.*churn(ed)? units|churn(ed)? units.*\b(ltm|ttm)\b/i, kind: "count", count: true, order: 4, bases: TRAILING_BASES },
  { key: "monthAnnualizedPct", label: "Annualized churn (month)", match: /annuali[sz]ed.*churn/i, kind: "percent", count: false, order: 3, bases: ["MONTHLY"] },
  { key: "monthChurned", label: "Churned units (month)", match: /churn(ed)? units|units churned/i, kind: "count", count: true, order: 2, bases: ["MONTHLY"] },
  { key: "bookableUnits", label: "Bookable units", match: /bookable units/i, kind: "count", count: true, order: 1, bases: ["POINT_IN_TIME"] },
];

/** A column's basis in words, for the caption under the table. */
export function brandChurnBasisLabel(column: BrandChurnColumn): string {
  return column.bases.some((basis) => basis === "LTM" || basis === "TTM") ? "trailing 12 months" : column.bases[0] === "POINT_IN_TIME" ? "point in time" : "month";
}

export type BrandChurnRow = {
  /** Stable per-row key: the same brand name under two populations is two rows. */
  id: string;
  brand: string;
  scopeLabel: string;
  bookableUnits: number | null;
  monthChurned: number | null;
  monthAnnualizedPct: number | null;
  ltmChurned: number | null;
  ltmPct: number | null;
};

export type BrandChurnTotals = {
  brands: number;
  bookableUnits: number | null;
  monthChurned: number | null;
  ltmChurned: number | null;
  /**
   * The reviewed table's own totals row: monthly churn annualised (month × 12 ÷
   * bookable units) and trailing churn ÷ bookable units. Derived here from the
   * reported counts, labelled as weighted, never a stored observation.
   */
  monthAnnualizedPct: number | null;
  ltmPct: number | null;
};

export type BrandChurn = {
  rows: BrandChurnRow[];
  totals: BrandChurnTotals;
  /** True when brands are reported under more than one population, so no total is added up. */
  totalsMixed: boolean;
  scopeLabels: string[];
  /**
   * Churn observations whose time basis does not match their column (or is
   * missing). They are counted, not guessed into a column.
   */
  ignoredTimeBasis: number;
  columns: { key: BrandChurnColumn["key"]; label: string; kind: MetricKind; count: boolean; basisLabel: string }[];
};

export function buildBrandChurn(metrics: readonly ReportMetric[], observations: readonly ReportObservation[], period: string): BrandChurn {
  const available = BRAND_CHURN_COLUMNS.filter((column) => metrics.some((metric) => column.match.test(metric.name)));

  // One definition per column, chosen deterministically (shortest name, then
  // metric key). Two definitions that both read as "churned units" therefore
  // cannot write the same cell in whatever order the rows happen to arrive.
  const columnForMetric = new Map<string, BrandChurnColumn>();
  const claimed = new Set<BrandChurnColumn["key"]>();
  for (const metric of [...metrics].sort((a, b) => a.name.length - b.name.length || a.metricKey.localeCompare(b.metricKey))) {
    const column = available.find((candidate) => !claimed.has(candidate.key) && candidate.match.test(metric.name));
    if (!column) continue;
    claimed.add(column.key);
    columnForMetric.set(metric.id, column);
  }

  // One row per brand *per population*: a brand that appears under two scopes
  // stays two rows rather than having its columns blended, and a total is never
  // added across populations.
  const brands = new Map<string, { row: BrandChurnRow; scopes: Set<string> }>();
  let ignoredTimeBasis = 0;
  for (const observation of currentPeriodRows(observations, period)) {
    const brand = observation.entityId;
    if (!brand) continue;
    if ((observation.comparisonBasis ?? "ACTUAL") !== "ACTUAL") continue;
    const column = columnForMetric.get(observation.kpiId);
    if (!column) continue;
    // Each column reads one time basis. A MONTHLY row only fills the monthly
    // columns, an LTM/TTM row only the trailing ones, a point-in-time row only
    // bookable units; a value that names no basis is never assumed into one.
    const basis = observation.timeBasis ?? null;
    if (basis === null || !column.bases.includes(basis)) {
      ignoredTimeBasis += 1;
      continue;
    }
    const value = parseNumber(observation.value);
    if (value === null) continue;

    const scope = { reportingScope: observation.reportingScope ?? "", entityScope: observation.entityScope ?? "" };
    const label = scopeLabel(scope);
    const id = `${scopeKey(scope)}\u0000${brand}`;
    const entry = brands.get(id) ?? {
      row: { id, brand, scopeLabel: label, bookableUnits: null, monthChurned: null, monthAnnualizedPct: null, ltmChurned: null, ltmPct: null },
      scopes: new Set<string>(),
    };
    entry.scopes.add(label);
    entry.row[column.key] = value;
    brands.set(id, entry);
  }

  const rows = [...brands.values()].map((entry) => entry.row).sort((a, b) => a.brand.localeCompare(b.brand) || a.scopeLabel.localeCompare(b.scopeLabel));
  const scopeLabels = [...new Set(rows.map((row) => row.scopeLabel))].sort();
  const totalsMixed = scopeLabels.length > 1;
  const sum = (key: "bookableUnits" | "monthChurned" | "ltmChurned"): number | null => {
    if (totalsMixed) return null;
    const values = rows.map((row) => row[key]).filter((value): value is number => value !== null);
    return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
  };

  // Totals are sums of reported counts only, and only within one population. The
  // percentages below are derived from those counts and the bookable units, the
  // way the reviewed table's own totals row is derived; no published rate is
  // averaged or re-weighted.
  const bookable = sum("bookableUnits");
  const monthly = sum("monthChurned");
  const trailing = sum("ltmChurned");
  const totals: BrandChurnTotals = {
    brands: new Set(rows.map((row) => row.brand)).size,
    bookableUnits: bookable,
    monthChurned: monthly,
    ltmChurned: trailing,
    // The reviewed table totals percentages only after dividing by bookable units;
    // with no denominator, or across populations, no percentage is shown. The
    // result is in percent points, like every other percent-kind value.
    monthAnnualizedPct: bookable ? (monthly === null ? null : ((monthly * 12) / bookable) * 100) : null,
    ltmPct: bookable ? (trailing === null ? null : (trailing / bookable) * 100) : null,
  };

  return {
    rows,
    totals,
    totalsMixed,
    scopeLabels,
    ignoredTimeBasis,
    columns: [...available]
      .sort((a, b) => a.order - b.order)
      .map((column) => ({ key: column.key, label: column.label, kind: column.kind, count: column.count, basisLabel: brandChurnBasisLabel(column) })),
  };
}
