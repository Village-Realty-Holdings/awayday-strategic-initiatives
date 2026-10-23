import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests with prisma mocked. The KPI resolver must never present a
// superseded, invalid or out-of-perimeter observation as the current value, and
// must not let one time basis (MONTHLY / YTD / LTM) overwrite another.

const { definitionFindUnique, observationFindMany, overrideFindFirst } = vi.hoisted(() => ({
  definitionFindUnique: vi.fn(),
  observationFindMany: vi.fn(),
  overrideFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kpiDefinition: { findUnique: definitionFindUnique },
    kpiObservation: { findMany: observationFindMany },
    kpiOverride: { findFirst: overrideFindFirst },
  },
}));

import {
  AmbiguousTimeBasisError,
  CONSOLIDATED_REPORTING_SCOPE,
  DEFAULT_TIME_BASIS,
  comparePeriods,
  observationIdentity,
  resolveKpi,
  resolveKpiSeries,
  selectCurrentObservations,
  selectDefaultObservation,
  type KpiObservationRecord,
} from "./kpi";

const definition = {
  id: "kpi_1",
  metricKey: "revenue",
  name: "Revenue",
  target: "1000",
  sourceType: "SNOWFLAKE",
};

type Row = KpiObservationRecord & { id?: string };

function observation(overrides: Partial<Row> = {}): Row {
  return {
    value: "100",
    reportingPeriod: "FY27-P09",
    observedAt: new Date("2026-09-30T12:00:00Z"),
    refreshedAt: new Date("2026-10-01T09:00:00Z"),
    quality: "VALID",
    publicationState: "APPROVED",
    revision: 1,
    reportingScope: CONSOLIDATED_REPORTING_SCOPE,
    comparisonBasis: "ACTUAL",
    timeBasis: "MONTHLY",
    authorityRank: 1,
    ...overrides,
  };
}

function givenRows(rows: Row[]) {
  definitionFindUnique.mockResolvedValue(definition);
  observationFindMany.mockResolvedValue(rows);
  overrideFindFirst.mockResolvedValue(null);
}

beforeEach(() => {
  definitionFindUnique.mockReset();
  observationFindMany.mockReset();
  overrideFindFirst.mockReset();
});

describe("resolveKpi — publication state", () => {
  it("ignores a newer SUPERSEDED row and returns the approved one", async () => {
    givenRows([
      observation({
        value: "999",
        observedAt: new Date("2026-10-15T00:00:00Z"),
        publicationState: "SUPERSEDED",
        supersededAt: new Date("2026-10-16T00:00:00Z"),
      } as Partial<Row>),
      observation({ value: "100", observedAt: new Date("2026-09-30T00:00:00Z") }),
    ]);

    const resolved = await resolveKpi("revenue");

    expect(resolved?.value).toBe("100");
    expect(resolved?.quality).toBe("VALID");
  });

  it("returns the newest approved row for one identity", async () => {
    givenRows([
      observation({ value: "120", observedAt: new Date("2026-10-05T00:00:00Z"), revision: 2 }),
      observation({ value: "100", observedAt: new Date("2026-09-30T00:00:00Z"), revision: 1 }),
    ]);

    expect((await resolveKpi("revenue"))?.value).toBe("120");
  });

  it("still tolerates a NULL publicationState in the in-memory selector", () => {
    // Defensive only: the column is NOT NULL since the migration, so the query no longer
    // asks for NULL rows (Prisma rejects a null filter on a non-nullable column, and the
    // resulting error made every resolve call fail). A row that arrives with NULL anyway
    // is treated as current rather than silently dropped.
    const rows = [observation({ value: "77", publicationState: null })];
    expect(selectCurrentObservations(rows)[0]?.value).toBe("77");
  });

  it("pushes the approved/quality rules into the database query", async () => {
    givenRows([observation()]);

    await resolveKpi("revenue");

    const [args] = observationFindMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toMatchObject({
      kpiId: "kpi_1",
      publicationState: "APPROVED",
      quality: { notIn: ["INVALID", "UNAVAILABLE"] },
    });
  });
});

describe("resolveKpi — override precedence", () => {
  it("a manual override beats every approved observation", async () => {
    givenRows([
      observation({ value: "100", observedAt: new Date("2026-10-15T00:00:00Z") }),
      observation({ value: "200", timeBasis: "LTM", observedAt: new Date("2026-10-16T00:00:00Z") }),
    ]);
    overrideFindFirst.mockResolvedValue({
      value: "150",
      reportingPeriod: "FY27-P09",
      createdAt: new Date("2026-10-17T00:00:00Z"),
    });

    const resolved = await resolveKpi("revenue");

    expect(resolved).toMatchObject({
      value: "150",
      source: "MANUAL",
      overrideActive: true,
      reportingPeriod: "FY27-P09",
    });
  });
});

describe("resolveKpi — time and comparison bases", () => {
  it("keeps MONTHLY and LTM side by side instead of overwriting", async () => {
    givenRows([
      observation({ value: "90", timeBasis: "MONTHLY" }),
      observation({ value: "1080", timeBasis: "LTM", observedAt: new Date("2026-10-10T00:00:00Z") }),
    ]);

    const series = await resolveKpiSeries("revenue");
    expect(series?.values).toHaveLength(2);
    expect(series?.values.map((value) => [value.timeBasis, value.value])).toEqual([
      ["MONTHLY", "90"],
      ["LTM", "1080"],
    ]);

    // The default single value is the monthly actual, not the newer LTM row.
    expect((await resolveKpi("revenue"))?.value).toBe("90");
    // and asking for each basis returns that basis.
    expect((await resolveKpi("revenue", { timeBasis: "LTM" }))?.value).toBe("1080");
    expect((await resolveKpi("revenue", { timeBasis: "MONTHLY" }))?.value).toBe("90");
  });

  it("does not let a BUDGET row overwrite the ACTUAL row of the same period", async () => {
    givenRows([
      observation({ value: "500", comparisonBasis: "BUDGET", observedAt: new Date("2026-10-12T00:00:00Z") }),
      observation({ value: "90", comparisonBasis: "ACTUAL" }),
    ]);

    expect((await resolveKpi("revenue"))?.value).toBe("90");
    expect((await resolveKpi("revenue", { comparisonBasis: "BUDGET" }))?.value).toBe("500");
  });

  it("keeps monthly and LTM in the pure selector as separate identities", () => {
    const winners = selectCurrentObservations([
      observation({ value: "90", timeBasis: "MONTHLY" }),
      observation({ value: "1080", timeBasis: "LTM" }),
    ]);

    expect(winners.map((row) => row.value)).toEqual(["90", "1080"]);
  });
});

describe("resolveKpi — quality", () => {
  it("excludes INVALID observations as current values", async () => {
    givenRows([
      observation({ value: "0", quality: "INVALID", observedAt: new Date("2026-10-15T00:00:00Z") }),
      observation({ value: "100", observedAt: new Date("2026-09-30T00:00:00Z") }),
    ]);

    expect((await resolveKpi("revenue"))?.value).toBe("100");
  });

  it("reports UNAVAILABLE rather than an INVALID value when nothing else qualifies", async () => {
    givenRows([observation({ value: "0", quality: "INVALID" })]);

    const resolved = await resolveKpi("revenue");

    expect(resolved).toMatchObject({ value: null, quality: "UNAVAILABLE", source: "UNAVAILABLE" });
  });

  it("excludes UNAVAILABLE observations as current values", async () => {
    givenRows([
      observation({ value: "", quality: "UNAVAILABLE" }),
      observation({ value: "100", quality: "STALE" }),
    ]);

    expect((await resolveKpi("revenue"))?.value).toBe("100");
  });
});

describe("resolveKpi — reporting scope", () => {
  it("only considers AWAYDAY_CONSOLIDATED rows when a scope is supplied", async () => {
    givenRows([
      observation({ value: "555", reportingScope: "REGION_NORTH", observedAt: new Date("2026-10-15T00:00:00Z") }),
      observation({ value: "444", reportingScope: null }),
      observation({ value: "100", reportingScope: CONSOLIDATED_REPORTING_SCOPE }),
    ]);

    const resolved = await resolveKpi("revenue", { reportingScope: CONSOLIDATED_REPORTING_SCOPE });

    expect(resolved?.value).toBe("100");
    expect(resolved?.reportingScope).toBe(CONSOLIDATED_REPORTING_SCOPE);

    const [args] = observationFindMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toMatchObject({ reportingScope: CONSOLIDATED_REPORTING_SCOPE });
  });

  it("does not fall back to another perimeter when an out-of-scope perimeter is asked for", async () => {
    givenRows([observation({ value: "100", reportingScope: CONSOLIDATED_REPORTING_SCOPE })]);

    const resolved = await resolveKpi("revenue", { reportingScope: "REGION_NORTH" });

    expect(resolved).toMatchObject({ value: null, quality: "UNAVAILABLE" });
    expect(observationFindMany).not.toHaveBeenCalled();
  });
});

describe("resolveKpi — historical periods", () => {
  it("resolves an explicitly requested older period", async () => {
    givenRows([
      observation({ value: "120", reportingPeriod: "FY27-P10", observedAt: new Date("2026-10-15T00:00:00Z") }),
      observation({ value: "100", reportingPeriod: "FY27-P09" }),
    ]);

    expect((await resolveKpi("revenue"))?.value).toBe("120");
    expect((await resolveKpi("revenue", { reportingPeriod: "FY27-P09" }))?.value).toBe("100");
  });

  it("falls back to the newest period that still has an approved value", async () => {
    givenRows([
      observation({ value: "130", reportingPeriod: "FY27-P10", publicationState: "SUPERSEDED" }),
      observation({ value: "100", reportingPeriod: "FY27-P09" }),
    ]);

    expect((await resolveKpi("revenue"))?.value).toBe("100");
    expect((await resolveKpi("revenue"))?.reportingPeriod).toBe("FY27-P09");
  });

  it("orders period labels naturally, so P10 is newer than P09", () => {
    expect(comparePeriods("FY27-P10", "FY27-P09")).toBeGreaterThan(0);
    expect(comparePeriods("FY27-P09", "FY27-P10")).toBeLessThan(0);
    expect(comparePeriods("2026-09", "2026-10")).toBeLessThan(0);
  });
});

describe("resolveKpi — missing definition", () => {
  it("returns null when the metric is unknown", async () => {
    definitionFindUnique.mockResolvedValue(null);

    expect(await resolveKpi("nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Observation identity — the entity is part of the fact.
//
// The staging incident on 2026-10-23 revised an approved ACTUAL/YTD revenue into a monthly
// prior-year figure because the resolver (and the table's unique key) identified an
// observation by too few columns. The entity is the same class of mistake one level down: a
// shop's figure and the consolidated figure for the same metric, period and basis are
// different facts, and a resolver that keys only on basis/scope lets one silently replace the
// other — and lets the second one vanish from a series.
// ---------------------------------------------------------------------------------------
describe("resolveKpi — entity identity", () => {
  const consolidated = () =>
    observation({ value: "328545736.74", timeBasis: "YTD", entityScope: "CONSOLIDATED", entityId: "AWAYDAY_CONSOLIDATED" });
  const shopA = () =>
    observation({ value: "1200.10", timeBasis: "YTD", entityScope: "SHOP", entityId: "shop-a" });
  const shopB = () =>
    observation({ value: "980.55", timeBasis: "YTD", entityScope: "SHOP", entityId: "shop-b" });

  it("treats two entities with the same basis as different identities", () => {
    const identityOf = (row: KpiObservationRecord) => observationIdentity(row);
    expect(identityOf(consolidated())).not.toBe(identityOf(shopA()));
    expect(identityOf(shopA())).not.toBe(identityOf(shopB()));
  });

  it("does not collapse two entities onto one row when selecting", () => {
    const winners = selectCurrentObservations([consolidated(), shopA(), shopB()]);
    expect(winners).toHaveLength(3);
    expect(winners.map((row) => row.entityId)).toEqual([
      "AWAYDAY_CONSOLIDATED",
      "shop-a",
      "shop-b",
    ]);
  });

  it("returns every entity in a series and one entity when asked for it", async () => {
    givenRows([consolidated(), shopA(), shopB()]);

    const series = await resolveKpiSeries("revenue");
    expect(series?.values).toHaveLength(3);
    expect(new Set(series?.values.map((value) => value.entityId))).toEqual(
      new Set(["AWAYDAY_CONSOLIDATED", "shop-a", "shop-b"]),
    );

    const one = await resolveKpi("revenue", { entityId: "shop-b" });
    expect(one?.value).toBe("980.55");
    expect(one?.entityScope).toBe("SHOP");
  });

  it("prefers the consolidated entity when no entity is named", async () => {
    givenRows([shopA(), consolidated()]);
    const resolved = await resolveKpi("revenue");
    expect(resolved?.entityId).toBe("AWAYDAY_CONSOLIDATED");
    expect(resolved?.value).toBe("328545736.74");
  });
});

// ---------------------------------------------------------------------------------------
// Monthly and YTD must never be confused.
//
// September 2026 consolidated revenue is published twice on purpose: ACTUAL/MONTHLY
// 31 415 017.89 (PF REV!E20) and ACTUAL/YTD 328 545 736.74 (PF REV!O20). They are two facts
// differing by a factor of ten, so "whichever row came back first" is not an acceptable way
// to choose between them.
// ---------------------------------------------------------------------------------------
describe("resolveKpi — explicit time-basis contract", () => {
  const monthly = () => observation({ value: "31415017.89", timeBasis: "MONTHLY" });
  const ytd = () => observation({ value: "328545736.74", timeBasis: "YTD" });

  it("names YTD as the documented default", () => {
    expect(DEFAULT_TIME_BASIS).toBe("YTD");
  });

  it("returns the YTD fact by default when monthly and YTD coexist", async () => {
    givenRows([monthly(), ytd()]);
    const resolved = await resolveKpi("revenue");
    expect(resolved).toMatchObject({ value: "328545736.74", timeBasis: "YTD" });
  });

  it("returns the monthly fact when the caller asks for it", async () => {
    givenRows([monthly(), ytd()]);
    const resolved = await resolveKpi("revenue", { timeBasis: "MONTHLY" });
    expect(resolved).toMatchObject({ value: "31415017.89", timeBasis: "MONTHLY" });
  });

  it("exposes both, side by side, in the series", async () => {
    givenRows([monthly(), ytd()]);
    const series = await resolveKpiSeries("revenue");
    expect(series?.values.map((value) => [value.timeBasis, value.value])).toEqual([
      ["MONTHLY", "31415017.89"],
      ["YTD", "328545736.74"],
    ]);
  });

  it("falls back to the only basis that exists", async () => {
    givenRows([observation({ value: "225.76", timeBasis: "MONTHLY" })]);
    const resolved = await resolveKpi("revenue");
    expect(resolved).toMatchObject({ value: "225.76", timeBasis: "MONTHLY" });
  });

  it("refuses to guess when the caller demanded an explicit basis", async () => {
    givenRows([monthly(), ytd()]);
    await expect(resolveKpi("revenue", { requireExplicitTimeBasis: true })).rejects.toThrow(
      AmbiguousTimeBasisError,
    );
  });

  it("accepts an explicit basis even in strict mode", async () => {
    givenRows([monthly(), ytd()]);
    const resolved = await resolveKpi("revenue", {
      timeBasis: "MONTHLY",
      requireExplicitTimeBasis: true,
    });
    expect(resolved?.value).toBe("31415017.89");
  });

  it("does not raise in strict mode when only one basis exists", async () => {
    givenRows([ytd()]);
    const resolved = await resolveKpi("revenue", { requireExplicitTimeBasis: true });
    expect(resolved?.value).toBe("328545736.74");
  });

  it("picks the documented default from the pure selector too", () => {
    const values = selectCurrentObservations([monthly(), ytd()]);
    expect(selectDefaultObservation(values).timeBasis).toBe("YTD");
    expect(selectDefaultObservation(values, { timeBasis: "MONTHLY" }).value).toBe("31415017.89");
  });
});
