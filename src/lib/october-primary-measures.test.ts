import { describe, expect, it } from "vitest";
import {
  OCTOBER_PRIMARY_CONFIG,
  describeChange,
  planOctoberConfiguration,
  type DefinitionState,
  type MappingState,
  type PillarState,
} from "./october-primary-measures";

// The reviewed October primary-measure configuration. These tests pin the
// properties engineering needs before anything is applied: one active mapping
// per value driver, FY27 targets untouched, no invented identity, and a plan
// that produces no changes when the configuration is already in place.

function mapping(overrides: Partial<MappingState> = {}): MappingState {
  return {
    active: true,
    calculation: "DIRECT",
    inputMetricKey: null,
    denominatorMetricKey: null,
    timeBasis: "YTD",
    displayFormat: "percent",
    higherIsBetter: true,
    targetBudget: null,
    targetStretch: null,
    ...overrides,
  };
}

function definition(metricKey: string, overrides: Partial<DefinitionState> = {}): DefinitionState {
  return { metricKey, id: `id-${metricKey}`, name: metricKey, strategicAreaId: `area-${metricKey.split(":")[1] ?? "x"}`, target: null, mapping: null, ...overrides };
}

/** The shape production is in now: the FY27 plan definition carries the active mapping. */
function productionState(): PillarState[] {
  return [
    {
      code: "M&A",
      areaId: "area-M&A",
      definitions: [definition("FY27:M&A", { name: "Acquired EBITDA closed", strategicAreaId: "area-M&A", target: "$26M total", mapping: mapping({ displayFormat: "currency", targetBudget: 26_000_000, targetStretch: 47_000_000 }) })],
    },
    {
      code: "GROW",
      areaId: "area-GROW",
      definitions: [
        definition("FY27:GROW", { name: "Gross unit adds", strategicAreaId: "area-GROW", target: "23% budget; 28% stretch", mapping: mapping({ targetBudget: 23, targetStretch: 28 }) }),
        definition("user_review:bd_unit_adds", { name: "BD Unit Adds (BD Master)", strategicAreaId: null }),
        definition("user_review:organic_unit_adds", { name: "Organic Unit Adds", strategicAreaId: "area-GROW" }),
      ],
    },
    {
      code: "RETENTION",
      areaId: "area-RETENTION",
      definitions: [
        definition("FY27:RETENTION", { name: "Owner unit churn (TTM)", strategicAreaId: "area-RETENTION", target: "11% budget; 9% stretch", mapping: mapping({ timeBasis: "LTM", higherIsBetter: false, targetBudget: 11, targetStretch: 9 }) }),
        definition("user_review:annualized_unit_churn", { name: "Annualized Unit Churn (Finance)", strategicAreaId: null }),
        definition("user_review:ttm_unit_churn_ares", { name: "TTM Unit Churn (Ares Pack)", strategicAreaId: "area-RETENTION" }),
      ],
    },
    {
      code: "TREVPAR",
      areaId: "area-TREVPAR",
      definitions: [
        definition("FY27:TREVPAR", { name: "TRevPAR growth (YoY)", strategicAreaId: "area-TREVPAR", target: "1% budget; 5% stretch", mapping: mapping({ calculation: "YOY_PCT", inputMetricKey: "trevpar_finance", targetBudget: 1, targetStretch: 5 }) }),
        definition("user_review:trevpar_growth_reported", { name: "TRevPAR Growth vs PY (Reported)", strategicAreaId: null }),
        definition("user_review:trevpar_growth_ex_ota", { name: "TRevPAR Growth vs PY (Ex-OTA)", strategicAreaId: "area-TREVPAR" }),
      ],
    },
    {
      code: "MARGIN",
      areaId: "area-MARGIN",
      definitions: [
        definition("FY27:MARGIN", { name: "Shop NOI margin vs PY", strategicAreaId: "area-MARGIN", target: "0.25% budget; 1% stretch", mapping: mapping({ calculation: "RATIO_DELTA_PY", targetBudget: 0.25, targetStretch: 1 }) }),
        definition("user_review:shop_noi_margin_delta_py_ex_ota", { name: "Shop NOI Margin vs PY (Ex-OTA, points)", strategicAreaId: null }),
        definition("user_review:shop_noi_margin_delta_py_reported", { name: "Shop NOI Margin vs PY (Reported)", strategicAreaId: "area-MARGIN" }),
      ],
    },
  ];
}

/** The same pillars after the configuration has been applied. */
function configuredState(): PillarState[] {
  const pillars = productionState();
  for (const entry of OCTOBER_PRIMARY_CONFIG) {
    const pillar = pillars.find((candidate) => candidate.code === entry.pillar)!;
    for (const definition of pillar.definitions) {
      if (definition.metricKey === entry.primaryMetricKey) {
        definition.strategicAreaId = pillar.areaId;
        definition.target = entry.goal;
        definition.mapping = mapping({ ...entry.mapping, active: true });
      } else if (definition.mapping) {
        definition.mapping = { ...definition.mapping, active: false };
      }
    }
  }
  return pillars;
}

describe("planOctoberConfiguration", () => {
  it("selects the reviewed measure for each value driver and leaves exactly one active mapping", () => {
    const plan = planOctoberConfiguration(productionState());
    expect(plan.issues).toEqual([]);
    expect(plan.pillars.map((pillar) => [pillar.pillar, pillar.primaryMetricKey, pillar.activeAfter.length])).toEqual([
      ["M&A", "FY27:M&A", 1],
      ["GROW", "user_review:bd_unit_adds", 1],
      ["RETENTION", "user_review:annualized_unit_churn", 1],
      ["TREVPAR", "user_review:trevpar_growth_reported", 1],
      ["MARGIN", "user_review:shop_noi_margin_delta_py_ex_ota", 1],
    ]);
  });

  it("links the reviewed definition to its pillar, because an unlinked KPI cannot be chosen as primary", () => {
    const plan = planOctoberConfiguration(productionState());
    const links = plan.changes.filter((change) => change.kind === "link-definition").map((change) => change.metricKey);
    expect(links.sort()).toEqual([
      "user_review:annualized_unit_churn",
      "user_review:bd_unit_adds",
      "user_review:shop_noi_margin_delta_py_ex_ota",
      "user_review:trevpar_growth_reported",
    ]);
    // M&A's identity already belongs to its pillar, so it is never re-linked.
    expect(links).not.toContain("FY27:M&A");
  });

  it("switches the FY27 plan mappings off in the same pass, so no pillar is ambiguous", () => {
    const plan = planOctoberConfiguration(productionState());
    const deactivated = plan.changes.filter((change) => change.kind === "deactivate-mapping").map((change) => change.metricKey);
    expect(deactivated.sort()).toEqual(["FY27:GROW", "FY27:MARGIN", "FY27:RETENTION", "FY27:TREVPAR"]);
  });

  it("never writes a FY27 budget or stretch value", () => {
    const plan = planOctoberConfiguration(productionState());
    for (const change of plan.changes) {
      if (change.kind !== "set-mapping") continue;
      // A brand-new reviewed mapping starts with no FY27 targets: those are
      // FP&A's to confirm, and a percent target beside a unit count would be a
      // comparison the review refuses anyway.
      expect(change.to.targetBudget).toBeNull();
      expect(change.to.targetStretch).toBeNull();
    }
    // The M&A mapping keeps its stored FY27 figures because the same identity stays primary.
    expect(plan.changes.some((change) => change.kind === "set-mapping" && change.metricKey === "FY27:M&A")).toBe(false);
  });

  it("states the 2026 goal only where it is comparable with the measure", () => {
    const plan = planOctoberConfiguration(productionState());
    const targets = plan.changes.filter((change) => change.kind === "set-target-text").map((change) => [change.metricKey, change.to]);
    // The goal is added in front of the wording the business already has, and no
    // existing figure is rewritten: "$26M total" and "11% budget; 9% stretch"
    // survive verbatim.
    expect(targets).toEqual([
      ["FY27:M&A", "2026 goal $23M · $26M total"],
      ["user_review:annualized_unit_churn", "2026 goal <12%"],
      ["user_review:trevpar_growth_reported", "2026 goal +3.3% reported"],
      ["user_review:shop_noi_margin_delta_py_ex_ota", "2026 goal +0.7 pt ex-OTA"],
    ]);
    // Grow's goal is a percentage beside a unit count, so no goal is written and
    // the reason is reported rather than silently smoothed over.
    expect(targets.some(([metricKey]) => metricKey === "user_review:bd_unit_adds")).toBe(false);
    expect(plan.notes.join(" ")).toContain("GROW: no 2026 goal written");
  });

  it("leaves target wording alone when it already states the same goal, and adds nothing twice", () => {
    // A definition whose wording already says "$23M goal" is not rewritten just
    // to add a year token: the figure and the meaning are already there.
    const pillars = productionState();
    const ma = pillars.find((pillar) => pillar.code === "M&A")!;
    ma.definitions[0].target = "$23M goal; $33M budget; $47M stretch";
    const plan = planOctoberConfiguration(pillars);
    expect(plan.changes.some((change) => change.kind === "set-target-text" && change.metricKey === "FY27:M&A")).toBe(false);
    // ...and running the plan over a definition that already says "2026 goal"
    // changes nothing either, which is what makes a second run a no-op.
    ma.definitions[0].target = "2026 goal $23M · $33M budget; $47M stretch";
    expect(planOctoberConfiguration(pillars).changes.some((change) => change.kind === "set-target-text" && change.metricKey === "FY27:M&A")).toBe(false);
  });

  it("keeps an unlabelled goal's wording and figure when the 2026 goal differs", () => {
    const pillars = productionState();
    const ma = pillars.find((pillar) => pillar.code === "M&A")!;
    ma.definitions[0].target = "$26M total; $47M stretch";
    const change = planOctoberConfiguration(pillars).changes.find((candidate) => candidate.kind === "set-target-text");
    expect(change).toMatchObject({ to: "2026 goal $23M · $26M total; $47M stretch" });
  });

  it("produces no changes when the configuration is already in place", () => {
    expect(planOctoberConfiguration(configuredState())).toMatchObject({ changes: [], issues: [] });
  });

  it("keeps supporting measures linked, and only ever deactivates a mapping", () => {
    const pillars = productionState();
    const grow = pillars.find((pillar) => pillar.code === "GROW")!;
    grow.definitions.push(definition("user_review:finance_unit_adds", { name: "Finance Unit Adds", strategicAreaId: "area-GROW", mapping: mapping({ active: true }) }));
    const plan = planOctoberConfiguration(pillars);
    // Two active mappings on one pillar: one is the reviewed primary, the other
    // is switched off, and the supporting definition itself stays linked.
    expect(plan.pillars.find((pillar) => pillar.pillar === "GROW")?.activeAfter).toEqual(["user_review:bd_unit_adds"]);
    const growDeactivations = plan.changes
      .filter((change) => change.kind === "deactivate-mapping" && (change.metricKey === "FY27:GROW" || change.metricKey === "user_review:finance_unit_adds"))
      .map((change) => change.metricKey)
      .sort();
    expect(growDeactivations).toEqual(["FY27:GROW", "user_review:finance_unit_adds"]);
    expect(plan.changes.some((change) => change.kind === "link-definition" && change.metricKey === "user_review:finance_unit_adds")).toBe(false);
  });

  it("refuses to plan against a missing identity", () => {
    const pillars = productionState().filter((pillar) => pillar.code !== "MARGIN");
    const plan = planOctoberConfiguration(pillars);
    expect(plan.issues.join(" ")).toContain("Pillar MARGIN is not in the active plan");
    expect(plan.changes.some((change) => change.kind === "set-mapping" && change.metricKey === "user_review:shop_noi_margin_delta_py_ex_ota")).toBe(false);
  });

  it("reports a driver the config does not cover without touching it", () => {
    const pillars = productionState();
    pillars.push({ code: "GUEST", areaId: "area-GUEST", definitions: [definition("FY27:GUEST", { name: "Review score", strategicAreaId: "area-GUEST" })] });
    const plan = planOctoberConfiguration(pillars);
    expect(plan.changes.some((change) => change.metricKey.startsWith("FY27:GUEST"))).toBe(false);
    expect(plan.notes.join(" ")).toContain("GUEST is not in the reviewed config and has 0 active mappings");
  });

  it("describes each change in words an engineer can check", () => {
    const plan = planOctoberConfiguration(productionState());
    expect(describeChange({ kind: "deactivate-mapping", metricKey: "FY27:GROW", from: mapping({ timeBasis: "YTD" }) })).toBe("deactivate FY27:GROW mapping (YTD, percent)");
    expect(plan.changes.map(describeChange).every((line) => line.length > 10)).toBe(true);
  });
});
