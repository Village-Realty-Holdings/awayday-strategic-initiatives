// Which KPI a pillar presents as its primary measure.
//
// The answer is persisted configuration, never list position. A pillar's
// primary measure is the KPI whose `KpiMeasureMapping` is active: an admin has
// deliberately chosen that KPI on Admin > Measure mappings, and the mapping is
// also where its targets and direction come from. KPIs without an active
// mapping are supporting measures and never displace it.
//
// This replaces taking the first KPI of a name-ordered list. That made the measure
// in the strategy house depend on alphabetical order, so renaming a KPI or
// adding a supporting metric could silently change (or steal) the headline
// measure. Here:
//
//   - exactly one active mapping  -> that KPI is the primary measure;
//   - no active mapping           -> no primary measure is claimed (neutral);
//   - more than one               -> ambiguous (neutral), never an alphabetical
//                                    tie-break.
//
// The resolver reads no name, no order and no date, so renaming, adding or
// reordering KPIs cannot change which one is primary.

export type MeasureCandidate = {
  id: string;
  name: string;
  measureMapping?: { active: boolean } | null;
};

export type PrimaryMeasureSelection<T> =
  | { status: "selected"; kpi: T }
  | { status: "missing" }
  | { status: "ambiguous"; kpis: readonly T[] };

/**
 * Select a pillar's primary measure from persisted mappings only.
 *
 * Callers pass every KPI the pillar owns, in any order. Names and array
 * positions are irrelevant to the result.
 */
export function selectPrimaryMeasure<T extends MeasureCandidate>(kpis: readonly T[]): PrimaryMeasureSelection<T> {
  const mapped = kpis.filter((kpi) => kpi.measureMapping?.active === true);
  if (mapped.length === 1) return { status: "selected", kpi: mapped[0] };
  if (mapped.length === 0) return { status: "missing" };
  return { status: "ambiguous", kpis: mapped };
}

/** The conflicting measure names, sorted for a stable, human-readable message. */
export function ambiguousMeasureNames(selection: Extract<PrimaryMeasureSelection<MeasureCandidate>, { status: "ambiguous" }>): string[] {
  return selection.kpis.map((kpi) => kpi.name).sort((a, b) => a.localeCompare(b));
}
