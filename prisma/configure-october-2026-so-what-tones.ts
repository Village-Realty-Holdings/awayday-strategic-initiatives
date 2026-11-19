import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  OCTOBER_SO_WHAT_TONE_CORRECTIONS,
  describeStructuralGap,
  describeToneCorrection,
  planSoWhatToneCorrections,
} from "../src/lib/october-so-what-tones";

// Prints — or, with --apply, writes — the semantic tone of the seven October 2026
// so-what records. See src/lib/october-so-what-tones.ts for the item-by-item
// comparison and for why the seven section summaries are recoloured rather than
// replaced (the 33-bullet restructure is proposed separately).
//
//   npx tsx prisma/configure-october-2026-so-what-tones.ts            # dry run
//   npx tsx prisma/configure-october-2026-so-what-tones.ts --apply    # write
//   npx tsx prisma/configure-october-2026-so-what-tones.ts --apply --snapshot oct-tones.json
//   npx tsx prisma/configure-october-2026-so-what-tones.ts --revert --snapshot oct-tones.json
//
// Safety, by construction:
//   * default is a dry run; nothing is written without --apply;
//   * only `ReviewSoWhat.tone` is written. Headline, body, scope, order, period,
//     created/updated identity and every other record are untouched;
//   * the record's headline, body and current tone must exactly match what the
//     correction expects, so a newer approved edit is reported as drift and never
//     overwritten; no row is deleted or inserted;
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
const SNAPSHOT = valueOf("--snapshot") ?? ".october-so-what-tones-before.json";

type Snapshot = {
  version: 1;
  capturedAt: string;
  before: { id: string; tone: string | null }[];
  after: { id: string; tone: string }[];
};

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function loadRecords() {
  return prisma.reviewSoWhat.findMany({
    where: { id: { in: OCTOBER_SO_WHAT_TONE_CORRECTIONS.map((correction) => correction.id) } },
    select: { id: true, scope: true, headline: true, body: true, tone: true },
    orderBy: { scope: "asc" },
  });
}

function report(rows: Awaited<ReturnType<typeof loadRecords>>, plan: ReturnType<typeof planSoWhatToneCorrections>) {
  const gap = describeStructuralGap();
  console.log(`\nOctober 2026 so-what tones — ${plan.changes.length} change(s), ${plan.drift.length} untouched.`);
  for (const change of plan.changes) console.log(`\n${describeToneCorrection(change)}`);
  for (const entry of plan.drift) {
    const label = entry.state === "already-applied" ? "already applied" : entry.state === "missing" ? "record missing" : "CHANGED SINCE THE CORRECTION WAS WRITTEN";
    console.log(`\n${entry.correction.scope} (${entry.correction.id}): ${label}`);
    if (entry.found) console.log(`  found: tone=${entry.found.tone ?? "NULL"} headline=${JSON.stringify(entry.found.headline)}`);
  }
  console.log(
    `\nStructural gap (not applied): ${gap.productionItems} stored section summaries vs ${gap.referenceItems} independently coloured bullets across ${gap.sections} sections.`,
  );
  console.log(gap.note);
  if (plan.drift.some((entry) => entry.state === "unexpected" || entry.state === "missing")) {
    console.log("\nRefusing to write while any record is missing or has drifted. Nothing was written.");
  }
  console.log(`\nWording, scope, order and every other record are untouched. ${rows.length} of ${OCTOBER_SO_WHAT_TONE_CORRECTIONS.length} records found.`);
}

async function apply() {
  const plan = planSoWhatToneCorrections(await loadRecords());
  if (plan.drift.some((entry) => entry.state === "unexpected" || entry.state === "missing")) {
    report(await loadRecords(), plan);
    throw new Error("Refusing to apply: a record is missing or its content has changed.");
  }
  if (plan.changes.length === 0) {
    console.log("Nothing to do: every so-what already carries its reviewed tone.");
    return;
  }

  const before: Snapshot["before"] = plan.changes.map((change) => ({ id: change.id, tone: change.from }));
  const after: Snapshot["after"] = plan.changes.map((change) => ({ id: change.id, tone: change.to }));

  await prisma.$transaction(
    async (tx: Tx) => {
      for (const change of plan.changes) {
        const current = await tx.reviewSoWhat.findUnique({ where: { id: change.id }, select: { tone: true, headline: true, body: true } });
        if (!current || current.tone !== null || current.headline !== change.headline || (current.body ?? "") !== change.body) {
          throw new Error(`Refusing to write: ${change.scope} changed while the correction was being applied.`);
        }
        await tx.reviewSoWhat.update({ where: { id: change.id }, data: { tone: change.to } });
        await tx.auditLog.create({
          data: {
            userId: null,
            action: "UPDATE",
            entity: "ReviewSoWhat",
            entityId: change.id,
            before: { tone: null },
            after: { tone: change.to, scope: change.scope, source: "october-2026-review-tone" },
          },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );

  const body: Snapshot = { version: 1, capturedAt: new Date().toISOString(), before, after };
  await writeFile(SNAPSHOT, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${plan.changes.length} so-what tone(s). Snapshot: ${SNAPSHOT}`);
}

async function revert() {
  const raw = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Partial<Snapshot>;
  if (raw.version !== 1 || !raw.before || !raw.after) {
    throw new Error(`Refusing to revert: ${SNAPSHOT} is not a version 1 snapshot. Nothing was written.`);
  }
  const body = raw as Snapshot;

  await prisma.$transaction(
    async (tx: Tx) => {
      for (const expected of body.after) {
        const current = await tx.reviewSoWhat.findUnique({ where: { id: expected.id }, select: { tone: true } });
        if (current?.tone !== expected.tone) {
          throw new Error(`Refusing to revert: ${expected.id} no longer holds what the correction wrote. Nothing was written.`);
        }
      }
      for (const previous of body.before) {
        await tx.reviewSoWhat.update({ where: { id: previous.id }, data: { tone: previous.tone as never } });
        await tx.auditLog.create({
          data: {
            userId: null,
            action: "UPDATE",
            entity: "ReviewSoWhat",
            entityId: previous.id,
            before: { tone: body.after.find((row) => row.id === previous.id)?.tone ?? null },
            after: { tone: previous.tone, reverted: true },
          },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );
  console.log(`\nReverted ${body.before.length} so-what tone(s) from ${SNAPSHOT}.`);
}

async function main() {
  if (REVERT) {
    await revert();
  } else if (APPLY) {
    await apply();
  } else {
    report(await loadRecords(), planSoWhatToneCorrections(await loadRecords()));
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
