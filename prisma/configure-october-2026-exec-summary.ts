import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  OCTOBER_2026_EXEC_SOURCE,
  planExecComparisons,
  planSummarySoWhats,
  type StoredExecComparison,
  type StoredSummary,
} from "../src/lib/october-exec-summary";

// Prints — or, with --apply, writes — the October 2026 executive-summary
// presentation: the four headline cards' reviewed comparison lines and the four
// "So what" bullets under them, transcribed from the reviewed report.
// See src/lib/october-exec-summary.ts for the exact text and why this is stored
// as presentation data rather than as fabricated observations.
//
//   npx tsx prisma/configure-october-2026-exec-summary.ts            # dry run
//   npx tsx prisma/configure-october-2026-exec-summary.ts --apply    # write
//   npx tsx prisma/configure-october-2026-exec-summary.ts --apply --snapshot oct-exec.json
//   npx tsx prisma/configure-october-2026-exec-summary.ts --revert --snapshot oct-exec.json
//
// Safety, by construction:
//   * default is a dry run; nothing is written without --apply;
//   * only ReviewExecComparison rows for 2026-10 and the month's SUMMARY so-whats
//     are written. No KpiObservation, target, mapping, pillar status or other
//     month is touched;
//   * a line or bullet holding anything other than what this correction expects
//     is reported as drift and the whole write is refused, so a newer approved
//     edit is never overwritten;
//   * the single summary record production already holds keeps its id: it is
//     updated to the report's first bullet, and three further bullets are added;
//     nothing is deleted;
//   * every write is one serializable transaction with an audit row per record,
//     and the before-state is snapshotted first so --revert can put it back.
//
// This is a production content correction, not part of an automatic release step.

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
const SNAPSHOT = valueOf("--snapshot") ?? ".october-exec-summary-before.json";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type Snapshot = {
  version: 1;
  capturedAt: string;
  periodId: string;
  execComparisons: { before: StoredExecComparison[]; createdIds: string[] };
  summary: { before: StoredSummary[]; createdIds: string[]; updatedIds: string[] };
};

const execComparisonId = (cardKey: string, order: number) => `oct-exec-${PERIOD}-${cardKey}-${order}`;

async function loadComparisons(): Promise<StoredExecComparison[]> {
  return prisma.reviewExecComparison.findMany({
    where: { periodId: PERIOD },
    orderBy: [{ cardKey: "asc" }, { order: "asc" }],
    select: { id: true, cardKey: true, order: true, text: true, tone: true, sourceDocumentName: true },
  });
}

async function loadSummary(): Promise<StoredSummary[]> {
  return prisma.reviewSoWhat.findMany({
    where: { periodId: PERIOD, scope: "SUMMARY" },
    orderBy: { order: "asc" },
    select: { id: true, order: true, headline: true, body: true, tone: true },
  });
}

async function report() {
  const [comparisons, summary] = await Promise.all([loadComparisons(), loadSummary()]);
  const execPlan = planExecComparisons(comparisons);
  const summaryPlan = planSummarySoWhats(summary);

  console.log(
    `\nOctober 2026 executive summary — ${execPlan.toCreate.length} comparison line(s) to add, ${execPlan.alreadyApplied} already applied; ${summaryPlan.toCreate.length + summaryPlan.toUpdate.length} so-what(s) to write, ${summaryPlan.alreadyApplied} already applied.`,
  );
  for (const line of execPlan.toCreate) console.log(`  + ${line.cardKey} [${line.order}] ${line.tone}: ${line.text}`);
  for (const entry of execPlan.drift) {
    console.log(`  ! ${entry.cardKey} [${entry.order}] holds: ${entry.found.text} (${entry.found.tone ?? "no tone"}) — left untouched`);
  }
  for (const bullet of summaryPlan.toCreate) console.log(`  + summary [${bullet.order}] ${bullet.tone}: ${bullet.headline}`);
  for (const update of summaryPlan.toUpdate) {
    console.log(`  ~ summary ${update.before.id}`);
    console.log(`      from: ${update.before.headline} (${update.before.tone ?? "no tone"})`);
    console.log(`        to: ${update.after.headline} (${update.after.tone})`);
  }
  for (const row of summaryPlan.drift) console.log(`  ! summary ${row.id} holds: ${row.headline} (${row.tone ?? "no tone"}) — left untouched`);

  console.log(`\nSource recorded with every comparison line: ${OCTOBER_2026_EXEC_SOURCE}`);
  console.log("No observation, target, mapping, pillar status or other month is written.");
  if (execPlan.drift.length > 0 || summaryPlan.drift.length > 0) {
    console.log("\nRefusing to write while anything has drifted. Nothing was written.");
  }
}

async function apply() {
  const [comparisonsBefore, summaryBefore] = await Promise.all([loadComparisons(), loadSummary()]);
  const execPlan = planExecComparisons(comparisonsBefore);
  const summaryPlan = planSummarySoWhats(summaryBefore);
  if (execPlan.drift.length > 0 || summaryPlan.drift.length > 0) {
    await report();
    throw new Error("Refusing to apply: a line or bullet holds content this correction did not expect.");
  }
  if (execPlan.toCreate.length === 0 && summaryPlan.toCreate.length === 0 && summaryPlan.toUpdate.length === 0) {
    console.log("Nothing to do: October already holds the reviewed executive-summary presentation.");
    return;
  }

  const snapshot: Snapshot = {
    version: 1,
    capturedAt: new Date().toISOString(),
    periodId: PERIOD,
    execComparisons: { before: comparisonsBefore, createdIds: execPlan.toCreate.map((line) => execComparisonId(line.cardKey, line.order)) },
    summary: {
      before: summaryBefore,
      createdIds: summaryPlan.toCreate.map((bullet) => bullet.id),
      updatedIds: summaryPlan.toUpdate.map((update) => update.before.id),
    },
  };

  await prisma.$transaction(
    async (tx: Tx) => {
      for (const line of execPlan.toCreate) {
        const id = execComparisonId(line.cardKey, line.order);
        await tx.reviewExecComparison.create({
          data: { id, periodId: PERIOD, cardKey: line.cardKey, order: line.order, text: line.text, tone: line.tone, sourceDocumentName: line.sourceDocumentName },
        });
        await tx.auditLog.create({
          data: { userId: null, action: "CREATE", entity: "ReviewExecComparison", entityId: id, before: {}, after: { ...line, periodId: PERIOD } },
        });
      }

      for (const update of summaryPlan.toUpdate) {
        const current = await tx.reviewSoWhat.findUnique({ where: { id: update.before.id }, select: { headline: true, body: true, tone: true } });
        if (!current || current.headline !== update.before.headline || (current.body ?? "") !== (update.before.body ?? "") || current.tone !== update.before.tone) {
          throw new Error(`Refusing to write: ${update.before.id} changed while the correction was being applied.`);
        }
        await tx.reviewSoWhat.update({
          where: { id: update.after.id },
          data: { order: update.after.order, headline: update.after.headline, body: update.after.body, tone: update.after.tone },
        });
        await tx.auditLog.create({
          data: {
            userId: null,
            action: "UPDATE",
            entity: "ReviewSoWhat",
            entityId: update.after.id,
            before: { headline: update.before.headline, body: update.before.body, tone: update.before.tone, order: update.before.order },
            after: { headline: update.after.headline, body: update.after.body, tone: update.after.tone, order: update.after.order, source: OCTOBER_2026_EXEC_SOURCE },
          },
        });
      }

      for (const bullet of summaryPlan.toCreate) {
        await tx.reviewSoWhat.create({
          data: { id: bullet.id, periodId: PERIOD, scope: "SUMMARY", order: bullet.order, headline: bullet.headline, body: bullet.body, tone: bullet.tone },
        });
        await tx.auditLog.create({
          data: { userId: null, action: "CREATE", entity: "ReviewSoWhat", entityId: bullet.id, before: {}, after: { ...bullet, scope: "SUMMARY", periodId: PERIOD, source: OCTOBER_2026_EXEC_SOURCE } },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );

  await writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(
    `\nWrote ${execPlan.toCreate.length} comparison line(s) and ${summaryPlan.toCreate.length + summaryPlan.toUpdate.length} so-what(s). Snapshot: ${SNAPSHOT}`,
  );
}

async function revert() {
  const raw = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Partial<Snapshot>;
  if (raw.version !== 1 || !raw.execComparisons || !raw.summary) {
    throw new Error(`Refusing to revert: ${SNAPSHOT} is not a version 1 snapshot. Nothing was written.`);
  }
  const body = raw as Snapshot;

  await prisma.$transaction(
    async (tx: Tx) => {
      for (const previous of body.summary.before) {
        const current = await tx.reviewSoWhat.findUnique({ where: { id: previous.id }, select: { id: true } });
        if (!current) throw new Error(`Refusing to revert: ${previous.id} is missing. Nothing was written.`);
      }
      for (const id of body.execComparisons.createdIds) {
        await tx.reviewExecComparison.delete({ where: { id } });
        await tx.auditLog.create({ data: { userId: null, action: "DELETE", entity: "ReviewExecComparison", entityId: id, before: { reverted: true }, after: {} } });
      }
      for (const id of body.summary.createdIds) {
        await tx.reviewSoWhat.delete({ where: { id } });
        await tx.auditLog.create({ data: { userId: null, action: "DELETE", entity: "ReviewSoWhat", entityId: id, before: { reverted: true }, after: {} } });
      }
      for (const previous of body.summary.before) {
        await tx.reviewSoWhat.update({
          where: { id: previous.id },
          data: { order: previous.order, headline: previous.headline, body: previous.body, tone: previous.tone as never },
        });
        await tx.auditLog.create({
          data: { userId: null, action: "UPDATE", entity: "ReviewSoWhat", entityId: previous.id, before: { reverted: true }, after: { headline: previous.headline, tone: previous.tone } },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );
  console.log(`\nReverted October's executive-summary presentation from ${SNAPSHOT}.`);
}

async function main() {
  if (REVERT) await revert();
  else if (APPLY) await apply();
  else await report();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
