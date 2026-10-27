import { describe, expect, it } from "vitest";
import { buildFinanceTable, formatKpiValue, type KpiRow } from "./review-kpi";
import {
  homeReviewPeriod,
  initiativeOwnerMatches,
  openUpdatePeriod,
  parseIsoDay,
  parseSoWhats,
  periodLabel,
  previousMonth,
  ragFor,
  reviewPeriods,
  shortCode,
  splitNames,
  synthesiseAreas,
} from "./review-model";

describe("synthesiseAreas (plans without StrategicArea rows)", () => {
  const FY26_DRIVERS = [
    "Margin expansion",
    "Key Enablers — Talent",
    "M&A",
    "TrevPAR expansion",
    "Owner retention",
    "Grow new units",
    "Key Enablers — Technology",
    "M&A",
    null,
  ];

  it("makes one area per driver, value drivers in house order then enablers", () => {
    const areas = synthesiseAreas(FY26_DRIVERS);
    expect(areas.map((a) => [a.name, a.kind])).toEqual([
      ["M&A", "VALUE_DRIVER"],
      ["Grow new units", "VALUE_DRIVER"],
      ["Owner retention", "VALUE_DRIVER"],
      ["TrevPAR expansion", "VALUE_DRIVER"],
      ["Margin expansion", "VALUE_DRIVER"],
      ["Other", "VALUE_DRIVER"],
      ["Talent", "ENABLER"],
      ["Technology", "ENABLER"],
    ]);
  });

  it("keeps the original driver so initiatives can be matched back", () => {
    const talent = synthesiseAreas(FY26_DRIVERS).find((a) => a.name === "Talent")!;
    expect(talent.driver).toBe("Key Enablers — Talent");
    expect(talent.code).toBe("TALENT");
  });
});

describe("reviewPeriods", () => {
  it("lists YYYY-MM periods newest first and ignores free text", () => {
    expect(reviewPeriods(["2026-08", "October 2026", "2026-09", null, "2026-09"])).toEqual(["2026-09", "2026-08"]);
  });

  it("falls back to last month when there is no data", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    expect(reviewPeriods([], now)).toEqual(["2026-09"]);
    expect(previousMonth(new Date("2027-01-05T00:00:00Z"))).toBe("2026-12");
  });

  it("labels periods", () => {
    expect(periodLabel("2026-09")).toBe("September 2026");
    expect(periodLabel("FY27-P09")).toBe("FY27-P09");
  });
});

describe("initiativeOwnerMatches", () => {
  const me = { id: "u1", name: "Kyle Sullivan" };

  it("uses the linked account when there is one", () => {
    expect(initiativeOwnerMatches({ ownerUserId: "u1", teamLead: "Someone Else" }, me)).toBe(true);
    expect(initiativeOwnerMatches({ ownerUserId: "u2", teamLead: "Kyle Sullivan" }, me)).toBe(false);
  });

  it("otherwise matches any named lead, case-insensitively", () => {
    expect(initiativeOwnerMatches({ ownerUserId: null, teamLead: "Dave Galford / kyle sullivan" }, me)).toBe(true);
    expect(initiativeOwnerMatches({ ownerUserId: null, teamLead: "Kyle Campbell" }, me)).toBe(false);
    expect(initiativeOwnerMatches({ ownerUserId: null, teamLead: null }, me)).toBe(false);
  });

  it("splits sponsor and lead strings", () => {
    expect(splitNames("Dan Yankley / Justin Ridgeway")).toEqual(["Dan Yankley", "Justin Ridgeway"]);
    expect(splitNames("TBD")).toEqual([]);
  });
});

describe("ragFor", () => {
  it("compares a value with its target", () => {
    expect(ragFor("25%", "23% budget; 28% stretch")).toBe("GREEN");
    expect(ragFor("22%", "23% budget")).toBe("AMBER");
    expect(ragFor("12%", "<11%")).toBe("AMBER");
    expect(ragFor("15%", "<11%")).toBe("RED");
  });

  it("is GREY without a value or a numeric target", () => {
    expect(ragFor(null, "23%")).toBe("GREY");
    expect(ragFor("10", "TBD")).toBe("GREY");
  });
});

describe("buildFinanceTable", () => {
  const defs = [
    { id: "rev", metricKey: "total_revenue", name: "Total Revenue", unit: "USD", displayFormat: "currency" },
    { id: "occ", metricKey: "occupancy_pct", name: "Occupancy %", unit: "percent", displayFormat: "percent" },
    { id: "none", metricKey: "gbv", name: "GBV", unit: "USD", displayFormat: "currency" },
  ];
  const base = { reportingPeriod: "2026-09", observedAt: new Date("2026-10-23"), quality: "VALID", publicationState: "APPROVED", reportingScope: "AWAYDAY_CONSOLIDATED", entityScope: "CONSOLIDATED" };
  const rows: KpiRow[] = [
    { ...base, kpiId: "rev", value: "31415017.89", comparisonBasis: "ACTUAL", timeBasis: "MONTHLY" },
    { ...base, kpiId: "rev", value: "26369842.05", comparisonBasis: "BUDGET", timeBasis: "MONTHLY" },
    // Superseded and invalid rows never reach the table.
    { ...base, kpiId: "rev", value: "1", comparisonBasis: "PRIOR_YEAR", timeBasis: "MONTHLY", publicationState: "SUPERSEDED" },
    { ...base, kpiId: "rev", value: "2", comparisonBasis: "VARIANCE", timeBasis: "MONTHLY", quality: "INVALID" },
    // Another month is ignored.
    { ...base, kpiId: "rev", value: "3", comparisonBasis: "ACTUAL", timeBasis: "MONTHLY", reportingPeriod: "2026-08" },
    // Shop-level rows are not consolidated.
    { ...base, kpiId: "occ", value: "40", comparisonBasis: "ACTUAL", timeBasis: "MONTHLY", entityScope: "SHOP", entityId: "S1" },
    { ...base, kpiId: "occ", value: "38.712833", comparisonBasis: "ACTUAL", timeBasis: "MONTHLY" },
  ];

  it("has a row per metric with data and a column per basis, in a fixed order", () => {
    const table = buildFinanceTable(defs, rows, "2026-09");
    expect(table.columns.map((c) => c.label)).toEqual(["Month Actual", "Month Budget"]);
    expect(table.rows.map((r) => r.label)).toEqual(["Total Revenue", "Occupancy %"]);
    expect(table.rows[0].cells).toEqual({ "MONTHLY:ACTUAL": "$31.4M", "MONTHLY:BUDGET": "$26.4M" });
    expect(table.rows[1].cells).toEqual({ "MONTHLY:ACTUAL": "38.7%" });
  });

  it("formats values from the definition's unit", () => {
    expect(formatKpiValue("225.76", { unit: "USD", displayFormat: "currency" })).toBe("$225.76");
    expect(formatKpiValue("-3849474.21", { unit: "USD", displayFormat: "currency" })).toBe("−$3.8M");
    expect(formatKpiValue("n/a", { unit: null, displayFormat: null })).toBe("n/a");
  });
});

describe("shortCode", () => {
  it("drops the plan prefix", () => {
    expect(shortCode("FY27-SI-001")).toBe("SI-001");
    expect(shortCode("M&A-01")).toBe("M&A-01");
  });
});

describe("homeReviewPeriod / openUpdatePeriod", () => {
  const periods = ["2026-10", "2026-09", "2026-08"];

  it("opens the review on the newest published month, or the newest when none is", () => {
    expect(homeReviewPeriod(periods, ["2026-09", "2026-08"])).toBe("2026-09");
    expect(homeReviewPeriod(periods, [])).toBe("2026-10");
  });

  it("opens My SIs on the newest month still taking updates, or the newest when all are published", () => {
    expect(openUpdatePeriod(periods, ["2026-10"])).toBe("2026-09");
    expect(openUpdatePeriod(periods, periods)).toBe("2026-10");
  });
});

describe("parseSoWhats", () => {
  const scopes = ["SUMMARY", "M&A"];

  it("keeps known scopes, trims, drops blanks and numbers each scope from 0", () => {
    const json = JSON.stringify([
      { scope: "M&A", headline: " Four closes ", body: " 942 units " },
      { scope: "SUMMARY", headline: "Shops beat", body: "" },
      { scope: "GHOST", headline: "Unknown area", body: "" },
      { scope: "SUMMARY", headline: " ", body: " " },
      { scope: "SUMMARY", headline: "", body: "CAC is the number nobody has explained." },
      { scope: "M&A", headline: "Pipeline is full", body: null },
    ]);
    expect(parseSoWhats(json, scopes)).toEqual([
      { scope: "M&A", order: 0, headline: "Four closes", body: "942 units" },
      { scope: "SUMMARY", order: 0, headline: "Shops beat", body: null },
      { scope: "SUMMARY", order: 1, headline: "CAC is the number nobody has explained.", body: null },
      { scope: "M&A", order: 1, headline: "Pipeline is full", body: null },
    ]);
  });

  it("caps text length and the number per scope", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ scope: "SUMMARY", headline: `${i}`.padEnd(500, "x"), body: "y".repeat(5000) }));
    const out = parseSoWhats(JSON.stringify(many), scopes);
    expect(out).toHaveLength(12);
    expect(out[0].headline).toHaveLength(200);
    expect(out[0].body).toHaveLength(2000);
  });

  it("yields nothing for invalid or non-array JSON", () => {
    expect(parseSoWhats("not json", scopes)).toEqual([]);
    expect(parseSoWhats('{"scope":"SUMMARY"}', scopes)).toEqual([]);
    expect(parseSoWhats(null, scopes)).toEqual([]);
  });
});

describe("parseIsoDay", () => {
  it("reads a calendar day at UTC midnight and rejects anything else", () => {
    expect(parseIsoDay("2026-10-15")?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(parseIsoDay("2026-02-30")).toBeNull();
    expect(parseIsoDay("15/10/2026")).toBeNull();
    expect(parseIsoDay("")).toBeNull();
  });
});
