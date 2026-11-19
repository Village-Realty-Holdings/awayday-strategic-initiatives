import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  REVIEWED_STATUS_SOURCE,
  describePillarStatusChange,
  planOctoberPillarStatuses,
  type AreaStatusState,
} from "../src/lib/october-reviewed-statuses";

// Prints — or, with --apply and engineering approval, applies — the reviewed
// October 2026 pillar statements from the strategy house on the reviewed page.
//
//   npx tsx prisma/configure-october-2026-statuses.ts            # dry run
//   npx tsx prisma/configure-october-2026-statuses.ts --apply    # write
//   npx tsx prisma/configure-october-2026-statuses.ts --apply --snapshot oct.json
//   npx tsx prisma/configure-october-2026-statuses.ts --revert --snapshot oct.json
//
// Safety, by construction:
//   * default is a dry run; nothing is written without --apply;
//   * the month is named explicitly, so September's four statuses can never be
//     touched by this script;
//   * a pillar that already holds a different status is reported, not overwritten;
//   * a published month is refused: publication locks are the app's to enforce;
//   * every write is one serializable transaction with an audit row, and the
//     before-state is snapshotted first so --revert can put it back;
//   * it never writes a KPI observation, never publishes, never deletes.
//
// This is a production data correction, not part of an automatic release step.

const PERIOD = "2026-10";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL to the target Postgres connection string.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const valueOf = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const APPLY = has("--apply");
const REVERT = has("--revert");
const SNAPSHOT = valueOf("--snapshot") ?? ".october-pillar-statuses-before.json";

type Snapshot = {
  version: 2;
  capturedAt: string;
  periodId: string;
  before: { code: string; areaId: string; id: string | null; status: string | null }[];
  after: { code: string; areaId: string; id: string | null; status: string | null }[];
};

async function loadAreas(): Promise<AreaStatusState[]> {
  const plan = await prisma.planVersion.findFirst({ where: { active: true }, select: { id: true } });
  if (!plan) throw new Error("No active plan found.");
  const codes = ["M&A", "GROW", "RETENTION", "TREVPAR", "MARGIN"];
  const areas = await prisma.strategicArea.findMany({
    where: { planVersionId: plan.id, code: { in: codes } },
    select: {
      id: true,
      code: true,
      kind: true,
      pillarStatuses: { where: { periodId: PERIOD }, select: { id: true, status: true } },
    },
  });
  return areas.map((area) => ({
    code: area.code,
    areaId: area.id,
    kind: area.kind as "VALUE_DRIVER" | "ENABLER",
    stored: area.pillarStatuses[0]?.status ?? null,
  }));
}

async function periodExistsAndIsDraft() {
  const period = await prisma.reviewPeriod.findUnique({ where: { id: PERIOD }, select: { id: true, status: true } });
  if (!period) throw new Error(`Review period ${PERIOD} does not exist. Nothing was written.`);
  return period;
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function applyChanges(tx: Tx, changes: ReturnType<typeof planOctoberPillarStatuses>["changes"]) {
  for (const change of changes) {
    const where = { periodId_strategicAreaId: { periodId: PERIOD, strategicAreaId: change.areaId } };
    const before = await tx.reviewPillarStatus.findUnique({ where, select: { id: true, status: true } });
    if ((before?.status ?? null) !== change.from) {
      throw new Error(`Refusing to write: ${change.code} changed while the plan was being applied.`);
    }
    const row = await tx.reviewPillarStatus.upsert({
      where,
      create: { periodId: PERIOD, strategicAreaId: change.areaId, status: change.to, updatedBy: REVIEWED_STATUS_SOURCE },
      update: { status: change.to, updatedBy: REVIEWED_STATUS_SOURCE },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        userId: null,
        action: before ? "UPDATE" : "CREATE",
        entity: "ReviewPillarStatus",
        entityId: row.id,
        before: before ? { status: before.status } : undefined,
        after: { status: change.to, periodId: PERIOD, areaId: change.areaId, code: change.code, source: REVIEWED_STATUS_SOURCE },
      },
    });
  }
}

async function snapshot(before: Snapshot["before"], after: Snapshot["after"]) {
  const body: Snapshot = { version: 2, capturedAt: new Date().toISOString(), periodId: PERIOD, before, after };
  await writeFile(SNAPSHOT, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return SNAPSHOT;
}

/**
 * Put the month back exactly as it was found, if and only if it still holds what
 * this script's apply left behind. A row this script created is deleted; a row it
 * updated is restored. Any other difference aborts before a single write.
 */
async function revert() {
  const raw = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Partial<Snapshot>;
  if (raw.version !== 2 || !raw.before || !raw.after || raw.periodId !== PERIOD) {
    throw new Error(`Refusing to revert: ${SNAPSHOT} is not a version 2 snapshot for ${PERIOD}. Nothing was written.`);
  }
  const body = raw as Snapshot;

  const result = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.reviewPillarStatus.findMany({
        where: { periodId: PERIOD, strategicAreaId: { in: body.after.map((row) => row.areaId) } },
        select: { id: true, strategicAreaId: true, status: true },
      });
      const drift: string[] = [];
      for (const expected of body.after) {
        const current = rows.find((row) => row.strategicAreaId === expected.areaId);
        if ((current?.status ?? null) !== expected.status) {
          drift.push(`${expected.code}: expected "${expected.status}", found "${current?.status ?? "(none)"}"`);
        }
      }
      if (drift.length > 0) return { restored: 0, drift };

      let restored = 0;
      for (const expected of body.before) {
        const where = { periodId_strategicAreaId: { periodId: PERIOD, strategicAreaId: expected.areaId } };
        const current = rows.find((row) => row.strategicAreaId === expected.areaId);
        if (expected.status === null) {
          if (!current) continue;
          await tx.reviewPillarStatus.delete({ where });
        } else if (current) {
          await tx.reviewPillarStatus.update({ where, data: { status: expected.status } });
        } else {
          await tx.reviewPillarStatus.create({ data: { periodId: PERIOD, strategicAreaId: expected.areaId, status: expected.status } });
        }
        await tx.auditLog.create({
          data: {
            userId: null,
            action: expected.status === null ? "DELETE" : "UPDATE",
            entity: "ReviewPillarStatus",
            entityId: current?.id ?? `period:${PERIOD}:area:${expected.areaId}`,
            before: current ? { status: current.status } : undefined,
            after: expected.status === null ? undefined : { status: expected.status, periodId: PERIOD, reverted: true },
          },
        });
        restored += 1;
      }
      return { restored, drift };
    },
    { isolationLevel: "Serializable" },
  );

  if (result.drift.length > 0) {
    console.log(JSON.stringify({ reverted: false, snapshot: SNAPSHOT, drift: result.drift }, null, 2));
    console.error("Refusing to revert: the month changed after this snapshot was taken. Nothing was written.");
    process.exitCode = 3;
    return;
  }
  console.log(JSON.stringify({ revertedFrom: SNAPSHOT, rowsRestored: result.restored }, null, 2));
}

async function main() {
  if (REVERT) {
    await revert();
    return;
  }
  const period = await periodExistsAndIsDraft();
  const areas = await loadAreas();
  const plan = planOctoberPillarStatuses(PERIOD, areas);
  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "APPLY" : "DRY RUN (no writes; pass --apply after approval)",
        period: { id: period.id, status: period.status },
        changes: plan.changes.map(describePillarStatusChange),
        alreadySet: plan.alreadySet,
        issues: plan.issues,
        untouched: ["2026-09 (September's four statuses are never read or written by this script)"],
      },
      null,
      2,
    ),
  );
  if (plan.issues.length > 0) {
    console.error("Aborted: fix the issues above. Nothing was written.");
    process.exitCode = 1;
    return;
  }
  if (!APPLY) return;
  if (plan.changes.length === 0) {
    console.log("Already configured: nothing to write.");
    return;
  }
  if (period.status === "PUBLISHED") {
    console.error(`Refusing to write: ${PERIOD} is published. Unpublish it through the app first. Nothing was written.`);
    process.exitCode = 2;
    return;
  }

  const existing = await prisma.reviewPillarStatus.findMany({
    where: { periodId: PERIOD, strategicAreaId: { in: areas.map((area) => area.areaId) } },
    select: { id: true, strategicAreaId: true },
  });
  const before = areas.map((area) => ({
    code: area.code,
    areaId: area.areaId,
    id: existing.find((candidate) => candidate.strategicAreaId === area.areaId)?.id ?? null,
    status: area.stored,
  }));
  const after = before.map((row) => {
    const change = plan.changes.find((candidate) => candidate.areaId === row.areaId);
    return { ...row, status: change ? change.to : row.status };
  });

  const path = await snapshot(before, after);
  await prisma.$transaction(async (tx) => applyChanges(tx, plan.changes), { isolationLevel: "Serializable" });
  console.log(JSON.stringify({ applied: plan.changes.length, snapshot: path }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
