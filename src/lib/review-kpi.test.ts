import { describe, expect, it } from "vitest";
import { currentKpiValue, measureValue, type KpiRow } from "./review-kpi";

// A pillar's measure must show the fact its mapping declares. BD unit adds is
// published as 330 for October and 3,340 year to date; a YTD mapping that showed
// the 330 would put the month's figure beside a year-to-date status.

const observedAt = new Date("2026-11-16T00:00:00Z");

function row(value: string, timeBasis: string, comparisonBasis = "ACTUAL", reportingScope = "USER_REVIEWED_REPORTED"): KpiRow {
  return {
    kpiId: "kpi-1",
    value,
    reportingPeriod: "2026-10",
    observedAt,
    quality: "VALID",
    publicationState: "APPROVED",
    reportingScope,
    comparisonBasis,
    timeBasis,
    entityScope: "REPORTED",
    entityId: null,
    revision: 1,
    authorityRank: 0,
  } as unknown as KpiRow;
}

const bdUnitAdds = [
  row("330", "MONTHLY"),
  row("295", "MONTHLY", "BUDGET"),
  row("3340", "YTD"),
  row("2608", "YTD", "BUDGET"),
];

describe("measureValue — the measure's value in its declared basis", () => {
  it("returns the year-to-date actual for a mapping declared YTD, not the month's own figure", () => {
    // The plain selector puts MONTHLY first, which is why this rule exists.
    expect(currentKpiValue(bdUnitAdds, "2026-10")?.value).toBe("330");
    expect(measureValue(bdUnitAdds, "2026-10", "YTD")?.value).toBe("3340");
  });

  it("returns the monthly actual when the mapping declares MONTHLY", () => {
    expect(measureValue(bdUnitAdds, "2026-10", "MONTHLY")?.value).toBe("330");
  });

  it("never picks a budget or prior-year row as the measure's value", () => {
    expect(measureValue(bdUnitAdds, "2026-10", "YTD")?.comparisonBasis).toBe("ACTUAL");
    expect(measureValue(bdUnitAdds, "2026-10", "MONTHLY")?.comparisonBasis).toBe("ACTUAL");
  });

  it("falls back to the year-to-date actual when the declared basis is not published", () => {
    // FY27:RETENTION's mapping says LTM while the metric publishes YTD: the
    // figure still shows, but only the basis that is actually there.
    expect(measureValue([row("12.4%", "YTD"), row("12.2%", "MONTHLY")], "2026-10", "LTM")?.value).toBe("12.4%");
  });

  it("keeps the plain newest value for a measure with no mapping", () => {
    expect(measureValue(bdUnitAdds, "2026-10", null)?.value).toBe("3340");
  });

  it("returns null rather than a figure from another month", () => {
    expect(measureValue(bdUnitAdds, "2026-09", "YTD")).toBeNull();
  });
});
