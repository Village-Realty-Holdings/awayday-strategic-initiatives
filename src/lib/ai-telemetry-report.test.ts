import { describe, it, expect, vi, beforeEach } from "vitest";

// Admin reporting over ai_invocation (docs/ai-telemetry-schema.md, rollout
// step 4). Aggregation is in memory over a findMany so it is mockable and
// exact for Decimal costs; the fixture deliberately mixes nulls (cost, user,
// acceptance) and every outcome so the null-safety is what is under test.

const { findManyMock, userFindManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  userFindManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { aiInvocation: { findMany: findManyMock }, user: { findMany: userFindManyMock } },
}));

import { buildAiTelemetryReport, coerceReportDays } from "./ai-telemetry-report";

type Row = {
  id: string;
  occurredAt: Date;
  module: string;
  feature: string;
  model: string;
  latencyMs: number;
  costUsd: unknown;
  outcome: string;
  errorClass: string | null;
  userId: string | null;
  acceptance: string | null;
};

const S = "claude-sonnet-5";
const O = "claude-opus-5";
const at = (s: string) => new Date(s);
const row = (
  id: string,
  occurredAt: string,
  module: string,
  feature: string,
  model: string,
  latencyMs: number,
  costUsd: unknown,
  outcome: string,
  errorClass: string | null,
  userId: string | null,
  acceptance: string | null,
): Row => ({ id, occurredAt: at(occurredAt), module, feature, model, latencyMs, costUsd, outcome, errorClass, userId, acceptance });

// 12 invocations, 3 features, 2 users (+ null), 3 days. Costs are strings as
// Prisma's Decimal stringifies; i7 uses a Decimal-like object to prove that
// path too.
const FIXTURE: Row[] = [
  row("i1", "2026-09-09T10:00:00Z", "INITIATIVES", "ask-board", S, 1000, "0.010000", "OK", null, "u1", null),
  row("i2", "2026-09-09T09:00:00Z", "INITIATIVES", "ask-board", S, 2000, "0.020000", "OK", null, "u2", null),
  row("i10", "2026-09-09T08:00:00Z", "PARTNERS", "contract-review", O, 6000, "0.300000", "OK", null, null, null),
  row("i11", "2026-09-09T07:00:00Z", "TALENT", "exec-summary", S, 2000, "0.020000", "OK", null, "u1", null),
  row("i3", "2026-09-08T10:00:00Z", "INITIATIVES", "ask-board", S, 500, null, "ERROR", "overloaded_error", "u1", null),
  row("i4", "2026-09-08T09:00:00Z", "TALENT", "exec-summary", S, 3000, "0.030000", "OK", null, "u1", "ACCEPTED"),
  row("i5", "2026-09-08T08:00:00Z", "TALENT", "exec-summary", S, 1000, "0.010000", "OK", null, "u2", "DISMISSED"),
  row("i12", "2026-09-08T07:00:00Z", "INITIATIVES", "ask-board", S, 1500, "0.015000", "OK", null, "u2", "NOT_APPLICABLE"),
  row("i6", "2026-09-07T10:00:00Z", "TALENT", "exec-summary", S, 0, null, "FALLBACK", "budget_exceeded", "u1", null),
  row("i7", "2026-09-07T09:00:00Z", "PARTNERS", "contract-review", O, 8000, { toString: () => "0.500000" }, "OK", null, null, "ACCEPTED"),
  row("i8", "2026-09-07T08:00:00Z", "PARTNERS", "contract-review", O, 7000, "0.400000", "OK", null, "u2", "EDITED"),
  row("i9", "2026-09-07T07:00:00Z", "PARTNERS", "contract-review", O, 100, null, "RATE_LIMITED", "rate_limit_error", "u2", null),
];

const NOW = new Date("2026-09-09T12:00:00Z");

beforeEach(() => {
  findManyMock.mockReset().mockResolvedValue(FIXTURE);
  // u2 has no User row (deleted account): the report must still list them.
  userFindManyMock.mockReset().mockResolvedValue([{ id: "u1", name: "Ann Example", email: "ann@awayday.com" }]);
});

describe("buildAiTelemetryReport", () => {
  it("queries the window and defaults to 30 days", async () => {
    await buildAiTelemetryReport(undefined, NOW);
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.occurredAt.gte.toISOString()).toBe("2026-08-10T12:00:00.000Z");
    const r7 = await buildAiTelemetryReport(7, NOW);
    expect(r7.window).toEqual({ days: 7, since: new Date("2026-09-02T12:00:00.000Z") });
  });

  it("computes null-safe totals", async () => {
    const r = await buildAiTelemetryReport(7, NOW);
    expect(r.totals.calls).toBe(12);
    expect(r.totals.costUsd).toBeCloseTo(1.305, 6);
    expect(r.totals.avgLatencyMs).toBe(2675);
    expect(r.totals.okRate).toBeCloseTo(9 / 12, 6);
    expect(r.totals.fallbackRate).toBeCloseTo(1 / 12, 6);
    expect(r.totals.acceptanceRate).toBeCloseTo(2 / 3, 6); // accepted 2 / (accepted 2 + dismissed 1)
  });

  it("groups by module+feature, sorted by cost desc, with per-feature health and acceptance counts", async () => {
    const r = await buildAiTelemetryReport(7, NOW);
    expect(r.byFeature.map((f) => f.feature)).toEqual(["contract-review", "exec-summary", "ask-board"]);
    expect(r.byFeature[0]).toMatchObject({
      module: "PARTNERS",
      feature: "contract-review",
      calls: 4,
      avgLatencyMs: 5275,
      fallbackCount: 0,
      errorCount: 1,
      accepted: 1,
      dismissed: 0,
      edited: 1,
    });
    expect(r.byFeature[0].costUsd).toBeCloseTo(1.2, 6);
    expect(r.byFeature[0].okRate).toBeCloseTo(0.75, 6);
    expect(r.byFeature[1]).toMatchObject({ feature: "exec-summary", calls: 4, avgLatencyMs: 1500, fallbackCount: 1, errorCount: 0, accepted: 1, dismissed: 1, edited: 0 });
    expect(r.byFeature[1].costUsd).toBeCloseTo(0.06, 6);
    expect(r.byFeature[2]).toMatchObject({ feature: "ask-board", calls: 4, avgLatencyMs: 1250, fallbackCount: 0, errorCount: 1, accepted: 0, dismissed: 0, edited: 0 });
    expect(r.byFeature[2].costUsd).toBeCloseTo(0.045, 6);
  });

  it("ranks users by cost, joins name/email, tolerates a missing User row, and excludes the null bucket", async () => {
    const r = await buildAiTelemetryReport(7, NOW);
    expect(userFindManyMock).toHaveBeenCalledTimes(1);
    expect(userFindManyMock.mock.calls[0][0].where.id.in.sort()).toEqual(["u1", "u2"]);
    expect(r.byUser.map((u) => u.userId)).toEqual(["u2", "u1"]);
    expect(r.byUser[0]).toMatchObject({ userId: "u2", name: null, email: null, calls: 5 });
    expect(r.byUser[0].costUsd).toBeCloseTo(0.445, 6);
    expect(r.byUser[1]).toMatchObject({ userId: "u1", name: "Ann Example", email: "ann@awayday.com", calls: 5 });
    expect(r.byUser[1].costUsd).toBeCloseTo(0.06, 6);
  });

  it("groups by UTC day ascending", async () => {
    const r = await buildAiTelemetryReport(7, NOW);
    expect(r.byDay.map((d) => d.day)).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
    expect(r.byDay.map((d) => d.calls)).toEqual([4, 4, 4]);
    expect(r.byDay[0].costUsd).toBeCloseTo(0.9, 6);
    expect(r.byDay[1].costUsd).toBeCloseTo(0.055, 6);
    expect(r.byDay[2].costUsd).toBeCloseTo(0.35, 6);
  });

  it("lists recent invocations newest first with numeric or null cost", async () => {
    const r = await buildAiTelemetryReport(7, NOW);
    expect(r.recent).toHaveLength(12);
    expect(r.recent[0]).toEqual({
      id: "i1",
      occurredAt: at("2026-09-09T10:00:00Z"),
      module: "INITIATIVES",
      feature: "ask-board",
      model: S,
      latencyMs: 1000,
      costUsd: 0.01,
      outcome: "OK",
      errorClass: null,
      acceptance: null,
    });
    expect(r.recent.find((x) => x.id === "i6")).toMatchObject({ costUsd: null, outcome: "FALLBACK", errorClass: "budget_exceeded" });
  });

  it("caps recent at 50 and users at 10; an empty window yields zeros, not NaN", async () => {
    const many: Row[] = Array.from({ length: 60 }, (_, i) =>
      row(`x${i}`, `2026-09-09T${String(i % 24).padStart(2, "0")}:00:00Z`, "PLATFORM", "unknown", S, 10, "0.001000", "OK", null, `user${i % 15}`, null),
    );
    findManyMock.mockResolvedValue(many);
    userFindManyMock.mockResolvedValue([]);
    const r = await buildAiTelemetryReport(30, NOW);
    expect(r.recent).toHaveLength(50);
    expect(r.byUser).toHaveLength(10);

    findManyMock.mockResolvedValue([]);
    const empty = await buildAiTelemetryReport(90, NOW);
    expect(empty.totals).toEqual({ calls: 0, costUsd: 0, avgLatencyMs: 0, okRate: 0, fallbackRate: 0, acceptanceRate: 0 });
    expect(empty.byFeature).toEqual([]);
    expect(empty.byUser).toEqual([]);
    expect(empty.byDay).toEqual([]);
    expect(empty.recent).toEqual([]);
    // No user lookup for an empty id set.
    expect(userFindManyMock).toHaveBeenCalledTimes(1);
  });
});

describe("coerceReportDays", () => {
  it.each([
    ["7", 7],
    ["30", 30],
    ["90", 90],
    ["14", 30],
    ["abc", 30],
    ["", 30],
    [null, 30],
    [undefined, 30],
  ])("coerceReportDays(%j) -> %s", (raw, expected) => {
    expect(coerceReportDays(raw)).toBe(expected);
  });
});
