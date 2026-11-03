import type { InitiativeStatus } from "@/generated/prisma/client";

// Rules for the local testing tool. No Node APIs or Prisma here, so the app
// shell can check the guard and tests can cover the rest directly.
//
// THIS MUST NEVER BE REACHABLE ON A DEPLOYMENT. The tool can change anyone's
// role and overwrite the database, so all three guards have to hold:
//
//   1. NODE_ENV is not "production". `next build` inlines it, so no Worker
//      bundle can enable this, even though OpenNext copies .env into it.
//   2. ENABLE_DEV_TESTING is explicitly on.
//   3. The database is on this machine.

export type DevTestingEnv = {
  NODE_ENV?: string;
  ENABLE_DEV_TESTING?: string;
  DATABASE_URL?: string;
  HYPERDRIVE_LOCAL?: string;
};

function readEnv(): DevTestingEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_DEV_TESTING: process.env.ENABLE_DEV_TESTING,
    DATABASE_URL: process.env.DATABASE_URL,
    HYPERDRIVE_LOCAL: process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE,
  };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isDevTestingEnabled(env: DevTestingEnv = readEnv()): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.ENABLE_DEV_TESTING !== "true" && env.ENABLE_DEV_TESTING !== "1") return false;
  if (!isLocalDatabaseUrl(env.DATABASE_URL)) return false;
  return !env.HYPERDRIVE_LOCAL || isLocalDatabaseUrl(env.HYPERDRIVE_LOCAL);
}

const BACKUP_NAME = /^(manual|auto)-\d{8}-\d{6}\.sql$/;

/** Only names this tool wrote can be restored, so a name can't point outside its folder. */
export function isBackupName(name: string): boolean {
  return BACKUP_NAME.test(name);
}

export function backupName(kind: "manual" | "auto", now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `${kind}-${stamp}.sql`;
}

export const TEST_MEASURE_PREFIX = "Test: ";
export const TEST_UPDATED_BY = "Dev testing";

const STATUS_CYCLE: InitiativeStatus[] = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "COMPLETE"];

const MEASURE_CYCLE = [
  { name: "green, at target", unit: "NUMBER", baseline: 40, target: 100, value: 105 },
  { name: "amber, lower is better", unit: "PERCENT", baseline: 20, target: 10, value: 10.5 },
  { name: "red, far from target", unit: "DOLLARS", baseline: 0, target: 1_000_000, value: 250_000 },
  { name: "no value yet", unit: "NUMBER", baseline: 0, target: 5, value: null },
] as const;

export type TestDataPlan = {
  initiativeId: string;
  /** Two in three SIs get this month's update; the rest stay a red x. */
  update: { status: InitiativeStatus; update: string; pathForward: string } | null;
  /** Every fifth SI has no measures, to test that state too. */
  measure: { name: string; kind: "KPI"; unit: string; baseline: number; target: number; value: number | null } | null;
};

/** A repeatable mix of statuses, updates and measures in every colour. */
export function buildTestData(initiativeIds: string[]): TestDataPlan[] {
  return initiativeIds.map((initiativeId, i) => {
    const cycled = MEASURE_CYCLE[i % MEASURE_CYCLE.length];
    return {
      initiativeId,
      update:
        i % 3 === 2
          ? null
          : { status: STATUS_CYCLE[i % STATUS_CYCLE.length], update: "Test update: what moved this month.", pathForward: "Test update: what happens next." },
      measure: i % 5 === 4 ? null : { ...cycled, name: `${TEST_MEASURE_PREFIX}${cycled.name}`, kind: "KPI" },
    };
  });
}
