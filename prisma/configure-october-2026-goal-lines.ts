import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { OCTOBER_GOAL_LINES, describeGoalLineChange, planGoalLineChanges } from "../src/lib/october-goal-lines";

// Prints — or, with --apply, writes — the reviewed October 2026 goal wording for
// the Grow and M&A pillar measures. See src/lib/october-goal-lines.ts for why
// each line reads the way it does, and for what is deliberately left alone.
//
//   npx tsx prisma/configure-october-2026-goal-lines.ts            # dry run
//   npx tsx prisma/configure-october-2026-goal-lines.ts --apply    # write
//   npx tsx prisma/configure-october-2026-goal-lines.ts --apply --snapshot oct-goals.json
//   npx tsx prisma/configure-october-2026-goal-lines.ts --revert --snapshot oct-goals.json
//
// Safety, by construction:
//   * default is a dry run; nothing is written without --apply;
//   * the target text must be exactly what the correction expects, so a newer
//     approved edit is reported as drift and never overwritten;
//   * only `KpiDefinition.target` is written. No observation, mapping, planning
//     record, publication state or revision is touched, and nothing is deleted;
//   * every write is one serializable transaction with an audit row per record,
//     and the before-state is snapshotted first so --revert can put it back.
//
// This is a production content correction, not part of an automatic release step.

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
const SNAPSHOT = valueOf("--snapshot") ?? ".october-goal-lines-before.json";

type Snapshot = {
  version: 2;
  capturedAt: string;
  before: { metricKey: string; id: string; target: string | null }[];
  after: { metricKey: string; id: string; target: string }[];
};

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function loadDefinitions() {
  return prisma.kpiDefinition.findMany({
    where: { metricKey: { in: OCTOBER_GOAL_LINES.map((line) => line.metricKey) } },
    select: { id: true, metricKey: true, name: true, target: true },
  });
}

async function readPlan() {
  const rows = await loadDefinitions();
  const plan = planGoalLineChanges(rows);
  return { rows, plan };
}

function report(rows: Awaited<ReturnType<typeof loadDefinitions>>, plan: ReturnType<typeof planGoalLineChanges>) {
  console.log(`\nOctober 2026 goal wording — ${plan.changes.length} change(s), ${plan.drift.length} untouched.`);
  for (const change of plan.changes) console.log(`\n${describeGoalLineChange(change)}`);
  for (const entry of plan.drift) {
    const label = entry.state === "already-applied" ? "already applied" : entry.state === "missing" ? "definition missing" : "CHANGED SINCE THE CORRECTION WAS WRITTEN";
    console.log(`\n${entry.line.name} (${entry.line.metricKey}): ${label}`);
    if (entry.state !== "missing") console.log(`  found: ${entry.found === null ? "(no target text)" : entry.found}`);
  }
  if (plan.drift.some((entry) => entry.state === "unexpected" || entry.state === "missing")) {
    console.log("\nRefusing to write while any definition is missing or has drifted. Nothing was written.");
  }
  console.log(
    `\nObservations, mappings and FY27 plan records are untouched. ${rows.length} of ${OCTOBER_GOAL_LINES.length} definitions found.`,
  );
}

async function apply() {
  const { plan } = await readPlan();
  if (plan.drift.some((entry) => entry.state === "unexpected" || entry.state === "missing")) {
    report(await loadDefinitions(), plan);
    throw new Error("Refusing to apply: a definition is missing or its target text has changed.");
  }
  if (plan.changes.length === 0) {
    console.log("Nothing to do: every goal line already reads as reviewed.");
    return;
  }

  const before: Snapshot["before"] = plan.changes.map((change) => ({
    metricKey: change.line.metricKey,
    id: change.id,
    target: change.line.from,
  }));
  const after: Snapshot["after"] = plan.changes.map((change) => ({
    metricKey: change.line.metricKey,
    id: change.id,
    target: change.line.to,
  }));

  await prisma.$transaction(
    async (tx: Tx) => {
      for (const change of plan.changes) {
        const current = await tx.kpiDefinition.findUnique({ where: { id: change.id }, select: { target: true } });
        if ((current?.target ?? null) !== change.line.from) {
          throw new Error(`Refusing to write: ${change.line.name} changed while the correction was being applied.`);
        }
        await tx.kpiDefinition.update({ where: { id: change.id }, data: { target: change.line.to } });
        await tx.auditLog.create({
          data: {
            userId: null,
            action: "UPDATE",
            entity: "KpiDefinition",
            entityId: change.id,
            before: { target: change.line.from },
            after: { target: change.line.to, metricKey: change.line.metricKey, source: "october-2026-review" },
          },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );

  const body: Snapshot = { version: 2, capturedAt: new Date().toISOString(), before, after };
  await writeFile(SNAPSHOT, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${plan.changes.length} goal line(s). Snapshot: ${SNAPSHOT}`);
}

async function revert() {
  const raw = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Partial<Snapshot>;
  if (raw.version !== 2 || !raw.before || !raw.after) {
    throw new Error(`Refusing to revert: ${SNAPSHOT} is not a version 2 snapshot. Nothing was written.`);
  }
  const body = raw as Snapshot;

  await prisma.$transaction(
    async (tx: Tx) => {
      for (const expected of body.after) {
        const current = await tx.kpiDefinition.findUnique({ where: { id: expected.id }, select: { target: true } });
        if ((current?.target ?? null) !== expected.target) {
          throw new Error(`Refusing to revert: ${expected.metricKey} no longer holds what the correction wrote. Nothing was written.`);
        }
      }
      for (const previous of body.before) {
        await tx.kpiDefinition.update({ where: { id: previous.id }, data: { target: previous.target } });
        await tx.auditLog.create({
          data: {
            userId: null,
            action: "UPDATE",
            entity: "KpiDefinition",
            entityId: previous.id,
            before: { target: body.after.find((row) => row.id === previous.id)?.target ?? null },
            after: { target: previous.target, metricKey: previous.metricKey, reverted: true },
          },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );
  console.log(`\nReverted ${body.before.length} goal line(s) from ${SNAPSHOT}.`);
}

async function main() {
  if (REVERT) {
    await revert();
  } else if (APPLY) {
    await apply();
  } else {
    report(await loadDefinitions(), (await readPlan()).plan);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
