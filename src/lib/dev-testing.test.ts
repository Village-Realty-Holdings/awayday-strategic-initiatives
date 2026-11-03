import { describe, expect, it } from "vitest";
import { backupName, buildTestData, isBackupName, isDevTestingEnabled, isLocalDatabaseUrl, TEST_MEASURE_PREFIX } from "./dev-testing";
import { appNow, devToday, setDevToday } from "./clock";

// The tool can change roles and overwrite the database, so the guards matter
// most: it must stay off in a production build, even with .env copied in.

const on = { NODE_ENV: "development", ENABLE_DEV_TESTING: "true", DATABASE_URL: "postgresql://a:b@localhost:5432/db" };

describe("isDevTestingEnabled", () => {
  it("is on only when explicitly enabled, outside production, with a local database", () => {
    expect(isDevTestingEnabled(on)).toBe(true);
    expect(isDevTestingEnabled({ ...on, ENABLE_DEV_TESTING: "1" })).toBe(true);
  });

  it("is off in a production build, whatever .env says", () => {
    expect(isDevTestingEnabled({ ...on, NODE_ENV: "production" })).toBe(false);
  });

  it("is off unless explicitly enabled", () => {
    expect(isDevTestingEnabled({ ...on, ENABLE_DEV_TESTING: undefined })).toBe(false);
    expect(isDevTestingEnabled({ ...on, ENABLE_DEV_TESTING: "false" })).toBe(false);
  });

  it("is off when any database is remote", () => {
    expect(isDevTestingEnabled({ ...on, DATABASE_URL: "postgresql://a:b@ep-x.neon.tech/db" })).toBe(false);
    expect(isDevTestingEnabled({ ...on, DATABASE_URL: undefined })).toBe(false);
    expect(isDevTestingEnabled({ ...on, HYPERDRIVE_LOCAL: "postgresql://a:b@ep-x.neon.tech/db" })).toBe(false);
  });
});

describe("isLocalDatabaseUrl", () => {
  it("doesn't take a lookalike host or a bad URL for local", () => {
    expect(isLocalDatabaseUrl("postgresql://a:b@127.0.0.1:5432/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://a:b@localhost.evil.com/db")).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
  });
});

describe("backup names", () => {
  it("accepts only names the tool writes", () => {
    const name = backupName("manual", new Date("2026-11-03T09:30:05Z"));
    expect(name).toBe("manual-20261103-093005.sql");
    expect(isBackupName(name)).toBe(true);
    expect(isBackupName("../../.env")).toBe(false);
    expect(isBackupName("manual-20261103-093005.sql/../x")).toBe(false);
  });
});

describe("buildTestData", () => {
  const plans = buildTestData(Array.from({ length: 20 }, (_, i) => `i${i}`));

  it("mixes SIs with and without an update, and every status", () => {
    expect(plans.some((p) => p.update === null)).toBe(true);
    expect(new Set(plans.flatMap((p) => (p.update ? [p.update.status] : [])))).toEqual(new Set(["ON_TRACK", "AT_RISK", "OFF_TRACK", "COMPLETE"]));
  });

  it("covers every measure state, each marked as test data", () => {
    const measures = plans.flatMap((p) => (p.measure ? [p.measure] : []));
    expect(plans.some((p) => p.measure === null)).toBe(true);
    expect(measures.every((m) => m.name.startsWith(TEST_MEASURE_PREFIX))).toBe(true);
    expect(measures.some((m) => m.value === null)).toBe(true);
    expect(new Set(measures.map((m) => m.unit)).size).toBeGreaterThan(1);
  });
});

describe("pretend date", () => {
  it("moves appNow until it's cleared", () => {
    setDevToday("2026-12-15");
    expect(devToday()).toBe("2026-12-15");
    expect(appNow().toISOString().slice(0, 10)).toBe("2026-12-15");
    setDevToday(null);
    expect(devToday()).toBeNull();
    expect(Math.abs(appNow().getTime() - Date.now())).toBeLessThan(1000);
  });
});
