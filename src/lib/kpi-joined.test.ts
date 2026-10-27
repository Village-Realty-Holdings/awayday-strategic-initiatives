import { describe, expect, it } from "vitest";
import { buildKpiJoinedRows, type KpiJoinedDefinition } from "./kpi-joined";

type Obs = KpiJoinedDefinition["observations"][number];

const obs = (over: Partial<Obs>): Obs => ({
  id: "o1",
  value: "100",
  reportingPeriod: "2026-09",
  comparisonBasis: "ACTUAL",
  timeBasis: "MONTHLY",
  reportingScope: "AWAYDAY_CONSOLIDATED",
  entityScope: "CONSOLIDATED",
  entityId: null,
  quality: "VALID",
  publicationState: "APPROVED",
  revision: 1,
  observedAt: new Date("2026-09-30T00:00:00Z"),
  refreshedAt: new Date("2026-10-23T00:00:00Z"),
  sourceDocumentName: "Financials.xlsx",
  sourceDocumentVersion: "1",
  sourceLocation: "sheet:PF REV!E20",
  valueDerivation: "REPORTED",
  authorityRank: 15,
  revisions: [],
  ...over,
});

const def = (over: Partial<KpiJoinedDefinition>): KpiJoinedDefinition => ({
  id: "d1",
  metricKey: "total_revenue",
  name: "Total Revenue",
  unit: "USD",
  displayFormat: "currency",
  target: null,
  sourceType: "SHAREPOINT_EXCEL",
  strategicArea: null,
  observations: [],
  ...over,
});

describe("buildKpiJoinedRows", () => {
  it("keeps a definition with no observations as one empty row", () => {
    const rows = buildKpiJoinedRows([def({ metricKey: "FY27:GROW", sourceType: "MANUAL", strategicArea: { name: "Grow New Units" } })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "d1", metricKey: "FY27:GROW", area: "Grow New Units", observation: null });
  });

  it("falls back to Company-wide when the metric has no area", () => {
    expect(buildKpiJoinedRows([def({})])[0].area).toBe("Company-wide");
  });

  it("emits one row per observation, sorted by period, basis, time basis", () => {
    const rows = buildKpiJoinedRows([
      def({
        observations: [
          obs({ id: "b", comparisonBasis: "BUDGET" }),
          obs({ id: "c", reportingPeriod: "2026-08" }),
          obs({ id: "a", comparisonBasis: "ACTUAL", value: "31415017.89" }),
        ],
      }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(rows[1].observation?.formattedValue).toBe("$31.4M");
  });

  it("orders definitions by source type (descending) then metric key", () => {
    const rows = buildKpiJoinedRows([def({ id: "m", metricKey: "FY27:GROW", sourceType: "MANUAL" }), def({ id: "s", metricKey: "adr", sourceType: "SHAREPOINT_EXCEL" })]);
    expect(rows.map((r) => r.id)).toEqual(["s", "m"]);
  });

  it("puts revisions in the row's history rather than adding rows", () => {
    const rows = buildKpiJoinedRows([
      def({
        observations: [
          obs({
            revision: 2,
            revisions: [
              { revision: 2, value: "110", publicationState: "APPROVED", recordedAt: new Date("2026-10-24T00:00:00Z") },
              { revision: 1, value: "100", publicationState: "APPROVED", recordedAt: new Date("2026-10-23T00:00:00Z") },
            ],
          }),
        ],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].observation?.revisions.map((r) => r.revision)).toEqual([1, 2]);
  });

  it("keeps a superseded observation's state", () => {
    const rows = buildKpiJoinedRows([def({ observations: [obs({ publicationState: "SUPERSEDED" })] })]);
    expect(rows[0].observation?.publicationState).toBe("SUPERSEDED");
  });
});
