// The reviewed October 2026 primary measure for each value driver, as
// configuration rather than convention.
//
// Why this file exists: a pillar's primary measure is the KPI whose
// `KpiMeasureMapping` is active (see `primary-measure.ts`). The October review
// measures are *reviewed* definitions (`user_review:*`) that today carry no
// pillar link and no mapping, while the FY27 *plan* definitions carry both. The
// values happen to be October's, which is why the mismatch reads as correct on
// screen: the plan definition's name and unit are not the October measure's.
//
// This config states, per pillar, exactly which identity is the October primary,
// what its mapping is, and what its target wording should say. It is pure: it
// reads a snapshot and returns the changes needed, so the same function proves
// the end state and proves the script is idempotent. No database access here, no
// figures that are not already stated by the reviewed report or the FY27 plan.
//
// Nothing in this file is applied to production. `prisma/configure-october-2026-
// primary-measures.ts` prints the plan by default and writes only with --apply,
// after engineering approval.

import { metricKind, parseTargetMarkers, primaryGoalMarker } from "@/lib/review-format";

/** A mapping as stored on `KpiMeasureMapping`. */
export type MappingState = {
  active: boolean;
  calculation: string;
  inputMetricKey: string | null;
  denominatorMetricKey: string | null;
  timeBasis: string;
  displayFormat: string;
  higherIsBetter: boolean | null;
  targetBudget: number | null;
  targetStretch: number | null;
};

/** One KPI definition as this planner needs to see it. */
export type DefinitionState = {
  metricKey: string;
  id: string;
  name: string;
  strategicAreaId: string | null;
  target: string | null;
  mapping: MappingState | null;
};

/** One value driver, its area, and every definition the pillar owns. */
export type PillarState = { code: string; areaId: string; definitions: DefinitionState[] };

export type OctoberPrimaryConfig = {
  /** StrategicArea.code of the value driver. */
  pillar: string;
  /** The KPI that becomes (or stays) the pillar's single active measure. */
  primaryMetricKey: string;
  /**
   * The measure's reporting basis and direction, as reviewed. `null` basis would
   * mean nothing is declared, which the review treats as "not configured", so
   * every entry states one.
   */
  mapping: Pick<MappingState, "calculation" | "timeBasis" | "displayFormat" | "higherIsBetter">;
  /**
   * The 2026 goal, phrased as it should read on the measure ("2026 goal $23M").
   *
   * The planner only ever ADDS this to a definition's target wording, and only
   * when the wording does not already state a goal in the measure's own
   * quantity. It never rewrites or removes an FY27 figure: those are printed
   * from what the mapping already stores, and a text the business has edited is
   * not reformatted behind its back.
   *
   * `null` means the reviewed report states no goal comparable with this
   * measure, so the pillar stays "Not configured" until FP&A or the owner
   * supplies one.
   */
  goal: string | null;
  /** Why the goal is what it is, or why it is absent. */
  note: string;
};

/**
 * The four reviewed October primaries plus M&A, whose identity already matches.
 *
 * `targetText` never restates a figure the business has not approved: the 2026
 * goals are the ones the reviewed report prints, and the FY27 figures carried in
 * the wording are the ones already stored in production. The FY27 targets on the
 * mappings are deliberately NOT rewritten here (see `preserve` below).
 */
export const OCTOBER_PRIMARY_CONFIG: readonly OctoberPrimaryConfig[] = [
  {
    pillar: "M&A",
    // Identity already matches the page ("Acquired EBITDA closed, YTD"); only the
    // target wording separates the 2026 goal from the FY27 planning figures.
    primaryMetricKey: "FY27:M&A",
    mapping: { calculation: "DIRECT", timeBasis: "YTD", displayFormat: "currency", higherIsBetter: true },
    goal: "2026 goal $23M",
    note: "Identity unchanged. 2026 goal $23M from the reviewed report. The FY27 budget and stretch already stored on the mapping are untouched and still display beside it.",
  },
  {
    pillar: "GROW",
    primaryMetricKey: "user_review:bd_unit_adds",
    mapping: { calculation: "DIRECT", timeBasis: "YTD", displayFormat: "number", higherIsBetter: true },
    // The reviewed report states Grow's 2026 goal as a growth percentage while
    // the October measure is a BD Master unit count (3,340 YTD). A count cannot
    // be judged against a percentage, so no goal is written and no status is
    // claimed. The page's printed "Ahead" is therefore an editorial status: it
    // must be approved as a ReviewPillarStatus, not derived from a ratio.
    goal: null,
    note: "BLOCKED: the 2026 goal ($/%) is stated in a different quantity from BD unit adds, so no status can be derived. Needs either a count-based 2026 goal from the Grow owner/FP&A, or an approved ReviewPillarStatus. FY27 22% / 30% from the board pre-read remains un-applied (see the FY27 note).",
  },
  {
    pillar: "RETENTION",
    primaryMetricKey: "user_review:annualized_unit_churn",
    mapping: { calculation: "DIRECT", timeBasis: "YTD", displayFormat: "percent", higherIsBetter: false },
    goal: "2026 goal <12%",
    note: "2026 goal <12% from the reviewed report. The FY27 values already stored stay as they are until FP&A confirms the board pre-read's 12% / 11%.",
  },
  {
    pillar: "TREVPAR",
    primaryMetricKey: "user_review:trevpar_growth_reported",
    mapping: { calculation: "DIRECT", timeBasis: "YTD", displayFormat: "percent", higherIsBetter: true },
    goal: "2026 goal +3.3% reported",
    note: "2026 goal +3.3% (reported basis) from the reviewed report. FY27 values preserved; the board pre-read says 1% / 3%.",
  },
  {
    pillar: "MARGIN",
    primaryMetricKey: "user_review:shop_noi_margin_delta_py_ex_ota",
    mapping: { calculation: "DIRECT", timeBasis: "YTD", displayFormat: "percent", higherIsBetter: true },
    goal: "2026 goal +0.7 pt ex-OTA",
    note: "2026 goal +0.7 pt on the ex-OTA basis from the reviewed report. FY27 0.25 pt / 1 pt preserved.",
  },
];

export type MeasureChange =
  | { kind: "link-definition"; metricKey: string; fromAreaId: string | null; toAreaId: string }
  | { kind: "set-mapping"; metricKey: string; from: MappingState | null; to: MappingState }
  | { kind: "deactivate-mapping"; metricKey: string; from: MappingState }
  | { kind: "set-target-text"; metricKey: string; from: string | null; to: string };

export type PillarPlan = {
  pillar: string;
  primaryMetricKey: string;
  /** Definitions of the pillar that keep an active mapping after this plan. */
  activeAfter: string[];
  issues: string[];
};

export type ConfigurationPlan = {
  changes: MeasureChange[];
  pillars: PillarPlan[];
  /** Problems that must be fixed before anything is written. */
  issues: string[];
  /** Things a human must decide, which the script will not do. */
  notes: string[];
};

function sameMapping(a: MappingState | null, b: MappingState): boolean {
  return (
    a !== null &&
    a.active === b.active &&
    a.calculation === b.calculation &&
    (a.inputMetricKey ?? null) === b.inputMetricKey &&
    (a.denominatorMetricKey ?? null) === b.denominatorMetricKey &&
    a.timeBasis === b.timeBasis &&
    a.displayFormat === b.displayFormat &&
    a.higherIsBetter === b.higherIsBetter
  );
}

/**
 * The changes needed to reach the reviewed configuration, plus every reason it
 * cannot be reached. Running this against its own output yields no changes,
 * which is what makes the script safe to re-run.
 *
 * Deliberately absent: any write to `targetBudget` / `targetStretch`, any rename,
 * any observation, and any change to a definition that is not the pillar's own
 * primary. The FY27 targets are FP&A's to confirm.
 */
export function planOctoberConfiguration(pillars: readonly PillarState[], config: readonly OctoberPrimaryConfig[] = OCTOBER_PRIMARY_CONFIG): ConfigurationPlan {
  const changes: MeasureChange[] = [];
  const pillarPlans: PillarPlan[] = [];
  const issues: string[] = [];
  const notes: string[] = [];

  for (const entry of config) {
    const pillar = pillars.find((p) => p.code === entry.pillar);
    if (!pillar) {
      issues.push(`Pillar ${entry.pillar} is not in the active plan.`);
      continue;
    }
    const primary = pillar.definitions.find((d) => d.metricKey === entry.primaryMetricKey);
    if (!primary) {
      issues.push(`KPI ${entry.primaryMetricKey} (${entry.pillar} primary) does not exist. Create the reviewed definition first; this script never invents one.`);
      continue;
    }

    // 1. Link the primary to the pillar, so the measure belongs to the pillar it
    //    is the headline for. Admin > Measure mappings only offers linked KPIs.
    if (primary.strategicAreaId !== pillar.areaId) {
      changes.push({ kind: "link-definition", metricKey: primary.metricKey, fromAreaId: primary.strategicAreaId, toAreaId: pillar.areaId });
    }

    // 2. Give the primary exactly one active mapping, in the reviewed direction
    //    and basis. FY27 targets are carried over if the mapping already has
    //    them; a new mapping leaves them unset rather than duplicating planning
    //    data that FP&A has not confirmed.
    const nextMapping: MappingState = {
      active: true,
      calculation: entry.mapping.calculation,
      inputMetricKey: primary.mapping?.inputMetricKey ?? null,
      denominatorMetricKey: primary.mapping?.denominatorMetricKey ?? null,
      timeBasis: entry.mapping.timeBasis,
      displayFormat: entry.mapping.displayFormat,
      higherIsBetter: entry.mapping.higherIsBetter,
      targetBudget: primary.mapping?.targetBudget ?? null,
      targetStretch: primary.mapping?.targetStretch ?? null,
    };
    if (!sameMapping(primary.mapping, nextMapping)) {
      changes.push({ kind: "set-mapping", metricKey: primary.metricKey, from: primary.mapping, to: nextMapping });
    }

    // 3. No other definition of the pillar may keep an active mapping, or the
    //    pillar becomes ambiguous and shows no primary at all.
    const deactivated = new Set<string>();
    for (const definition of pillar.definitions) {
      if (definition.metricKey === primary.metricKey) continue;
      if (definition.mapping?.active) {
        changes.push({ kind: "deactivate-mapping", metricKey: definition.metricKey, from: definition.mapping });
        deactivated.add(definition.metricKey);
      }
    }

    // 4. Make sure the 2026 goal is stated in the primary's target wording, so a
    //    status can actually be judged. The goal is only ADDED: if the wording
    //    already states a goal the measure can be judged against, it is left
    //    exactly as the business wrote it, and no FY27 figure is ever rewritten.
    const kind = metricKind({ name: primary.name, displayFormat: nextMapping.displayFormat, unit: null });
    const stated = primaryGoalMarker(parseTargetMarkers(primary.target), kind);
    const goalMarker = entry.goal ? primaryGoalMarker(parseTargetMarkers(entry.goal), kind) : null;
    if (entry.goal === null || goalMarker === null) {
      // A goal that cannot be parsed is not written: an unreadable target is
      // exactly the case the review refuses to rate.
      notes.push(`${entry.pillar}: no 2026 goal written. ${entry.note}`);
    } else if (stated === null) {
      const next = primary.target ? `${entry.goal} · ${primary.target}` : entry.goal;
      changes.push({ kind: "set-target-text", metricKey: primary.metricKey, from: primary.target ?? null, to: next });
    } else if (stated.reference !== "2026" && stated.value !== goalMarker.value) {
      // The wording states a goal, but not the 2026 one. The 2026 goal is added
      // in front and the original words are kept verbatim, so no figure moves.
      changes.push({ kind: "set-target-text", metricKey: primary.metricKey, from: primary.target ?? null, to: `${entry.goal} · ${primary.target}` });
    }

    // What the pillar's active set looks like once this plan is applied, not what
    // it looks like now: a mapping this plan switches off must not count.
    const activeAfter = pillar.definitions
      .filter((d) => d.metricKey === primary.metricKey || (d.mapping?.active && !deactivated.has(d.metricKey)))
      .map((d) => d.metricKey)
      .filter((key, index, all) => all.indexOf(key) === index);

    const pillarIssues: string[] = [];
    if (activeAfter.length !== 1) pillarIssues.push(`${entry.pillar} would have ${activeAfter.length} active mappings (${activeAfter.join(", ")}); exactly one is required.`);
    issues.push(...pillarIssues);
    pillarPlans.push({ pillar: entry.pillar, primaryMetricKey: entry.primaryMetricKey, activeAfter, issues: pillarIssues });
  }

  // Every value driver in the plan should end with one primary. A driver the
  // config does not mention is reported, not guessed at.
  for (const pillar of pillars) {
    if (config.some((entry) => entry.pillar === pillar.code)) continue;
    const active = pillar.definitions.filter((d) => d.mapping?.active).length;
    if (active !== 1) notes.push(`${pillar.code} is not in the reviewed config and has ${active} active mappings.`);
  }

  return { changes, pillars: pillarPlans, issues, notes };
}

/** A one-line description of a change, for the review printout and the audit trail. */
export function describeChange(change: MeasureChange): string {
  switch (change.kind) {
    case "link-definition":
      return `link ${change.metricKey} to area ${change.toAreaId} (was ${change.fromAreaId ?? "unlinked"})`;
    case "set-mapping":
      return `set ${change.metricKey} mapping to ${change.to.calculation} · ${change.to.timeBasis} · ${change.to.displayFormat} · ${change.to.higherIsBetter === null ? "no direction" : change.to.higherIsBetter ? "higher" : "lower"} · active (was ${change.from ? `${change.from.timeBasis} · active=${change.from.active}` : "none"})`;
    case "deactivate-mapping":
      return `deactivate ${change.metricKey} mapping (${change.from.timeBasis}, ${change.from.displayFormat})`;
    case "set-target-text":
      return `set ${change.metricKey} target wording to "${change.to}" (was "${change.from ?? "none"}")`;
  }
}
