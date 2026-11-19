import "dotenv/config";
import { writeFile, readFile } from "node:fs/promises";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  OCTOBER_PRIMARY_CONFIG,
  describeChange,
  describeRestore,
  expectedAfter,
  planOctoberConfiguration,
  planRevert,
  type ConfigurationSnapshot,
  type CurrentDefinition,
  type DefinitionState,
  type MappingState,
  type PillarState,
  type SnapshotPillar,
} from "../src/lib/october-primary-measures";

// Prints — or, with --apply and engineering approval, applies — the reviewed
// October 2026 primary-measure configuration for the five value drivers.
//
//   npx tsx prisma/configure-october-2026-primary-measures.ts            # dry run
//   npx tsx prisma/configure-october-2026-primary-measures.ts --apply    # write
//   npx tsx prisma/configure-october-2026-primary-measures.ts --apply --snapshot before.json
//   npx tsx prisma/configure-october-2026-primary-measures.ts --revert --snapshot before.json
//
// Safety, by construction:
//   * default is a dry run; nothing is written without --apply;
//   * identities are found by metricKey, never by name or list position;
//   * a missing identity, or a pillar that would end with anything other than
//     exactly one active mapping, aborts before any write;
//   * it never renames a KPI, never writes an observation, never publishes, and
//     never changes targetBudget / targetStretch on the FY27 mappings;
//   * --apply records a before-snapshot, and --revert restores it.
//
// This is a production data correction. Running it is an engineering decision,
// not part of any automatic release step.

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
const SNAPSHOT = valueOf("--snapshot") ?? ".october-primary-measures-before.json";

const MAPPING_SELECT = {
  active: true,
  calculation: true,
  inputMetricKey: true,
  denominatorMetricKey: true,
  timeBasis: true,
  displayFormat: true,
  higherIsBetter: true,
  targetBudget: true,
  targetStretch: true,
} as const;

async function loadPillars(): Promise<PillarState[]> {
  const plan = await prisma.planVersion.findFirst({ where: { active: true }, select: { id: true, code: true } });
  if (!plan) throw new Error("No active plan found.");
  const codes = OCTOBER_PRIMARY_CONFIG.map((entry) => entry.pillar);
  const areas = await prisma.strategicArea.findMany({
    where: { planVersionId: plan.id, code: { in: codes } },
    select: {
      id: true,
      code: true,
      kpis: { select: { id: true, metricKey: true, name: true, strategicAreaId: true, target: true, measureMapping: { select: MAPPING_SELECT } } },
    },
  });
  // The reviewed definitions are the primaries for four pillars and may not be
  // linked to their area yet, so they are loaded by key as well.
  const reviewedKeys = OCTOBER_PRIMARY_CONFIG.filter((entry) => entry.primaryMetricKey !== `${plan.code}:${entry.pillar}`).map((entry) => entry.primaryMetricKey);
  const unlinked = await prisma.kpiDefinition.findMany({
    // `strategicAreaId` is null for a reviewed definition no pillar owns yet, and
    // SQL's `NOT IN` does not match null, so "not linked to one of these areas"
    // must be written as "unlinked, or linked elsewhere". Without the explicit
    // null branch the script could never find the definitions it exists to link.
    where: {
      metricKey: { in: reviewedKeys },
      OR: [{ strategicAreaId: null }, { strategicAreaId: { notIn: areas.map((area) => area.id) } }],
    },
    select: { id: true, metricKey: true, name: true, strategicAreaId: true, target: true, measureMapping: { select: MAPPING_SELECT } },
  });

  return codes.map((code) => {
    const area = areas.find((candidate) => candidate.code === code);
    if (!area) return { code, areaId: "", definitions: [] };
    // Only THIS pillar's reviewed primary is added; an unlinked definition is
    // not a definition of every pillar, and listing it under each one would
    // duplicate it in the snapshot and in the revert.
    const primaryKey = OCTOBER_PRIMARY_CONFIG.find((entry) => entry.pillar === code)?.primaryMetricKey;
    const ownUnlinked = unlinked.filter((definition) => definition.metricKey === primaryKey);
    const definitions: DefinitionState[] = [...area.kpis, ...ownUnlinked].map((definition) => ({
      metricKey: definition.metricKey,
      id: definition.id,
      name: definition.name,
      strategicAreaId: definition.strategicAreaId ?? null,
      target: definition.target ?? null,
      mapping: (definition.measureMapping as MappingState | null) ?? null,
    }));
    return { code, areaId: area.id, definitions };
  });
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function applyChanges(tx: Tx, pillars: readonly PillarState[], changes: ReturnType<typeof planOctoberConfiguration>["changes"]) {
  for (const change of changes) {
    const definition = pillars.flatMap((pillar) => pillar.definitions).find((candidate) => candidate.metricKey === change.metricKey);
    if (!definition) throw new Error(`Refusing to write: ${change.metricKey} is not in the loaded state.`);
    if (change.kind === "link-definition") {
      await tx.kpiDefinition.update({ where: { id: definition.id }, data: { strategicAreaId: change.toAreaId } });
    } else if (change.kind === "set-target-text") {
      await tx.kpiDefinition.update({ where: { id: definition.id }, data: { target: change.to } });
    } else if (change.kind === "set-mapping") {
      const data = {
        calculation: change.to.calculation,
        inputMetricKey: change.to.inputMetricKey,
        denominatorMetricKey: change.to.denominatorMetricKey,
        timeBasis: change.to.timeBasis,
        displayFormat: change.to.displayFormat,
        higherIsBetter: change.to.higherIsBetter,
        active: true,
      };
      // targetBudget / targetStretch are only written when the mapping does not
      // have them yet, and then only as null: the FY27 figures are FP&A's.
      await tx.kpiMeasureMapping.upsert({
        where: { measureKpiId: definition.id },
        update: data,
        create: { measureKpiId: definition.id, ...data, targetBudget: change.to.targetBudget, targetStretch: change.to.targetStretch },
      });
    } else {
      await tx.kpiMeasureMapping.update({ where: { measureKpiId: definition.id }, data: { active: false } });
    }
  }
}

function toSnapshotPillars(pillars: readonly PillarState[]): SnapshotPillar[] {
  return pillars.map((pillar) => ({
    code: pillar.code,
    areaId: pillar.areaId,
    definitions: pillar.definitions.map((definition) => ({
      metricKey: definition.metricKey,
      strategicAreaId: definition.strategicAreaId,
      target: definition.target,
      mapping: definition.mapping,
    })),
  }));
}

async function snapshot(pillars: readonly PillarState[], after: readonly SnapshotPillar[]) {
  const body = {
    version: 2 as const,
    capturedAt: new Date().toISOString(),
    before: toSnapshotPillars(pillars),
    after,
  } satisfies ConfigurationSnapshot;
  await writeFile(SNAPSHOT, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return SNAPSHOT;
}

/** The snapshot's definitions, flattened, for the drift check. */
function snapshotDefinitions(pillars: readonly SnapshotPillar[]) {
  return pillars.flatMap((pillar) => pillar.definitions);
}

/**
 * Restore the pre-apply state, if and only if production still matches what the
 * apply left behind.
 *
 * Safety, by construction:
 *   * the whole restore is one serializable transaction, so it either lands
 *     completely or not at all;
 *   * the current state is re-read inside that transaction and compared with the
 *     snapshot's `after` state; any difference aborts before a single write;
 *   * only the fields the plan manages are compared or restored, so a later FP&A
 *     change to `targetBudget` / `targetStretch` survives untouched;
 *   * a mapping the plan did not create is never deleted, and a mapping the plan
 *     did create is deleted only when it still looks exactly as the plan left it.
 */
async function revert() {
  const raw = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Partial<ConfigurationSnapshot>;
  if (raw.version !== 2 || !raw.before || !raw.after) {
    throw new Error(
      `Refusing to revert: ${SNAPSHOT} is not a version 2 snapshot (it predates drift detection). Re-run --apply to capture one; nothing was written.`,
    );
  }
  const snapshotBody = raw as ConfigurationSnapshot;
  const keys = snapshotDefinitions(snapshotBody.after).map((definition) => definition.metricKey);

  const result = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.kpiDefinition.findMany({
        where: { metricKey: { in: keys } },
        select: { metricKey: true, strategicAreaId: true, target: true, measureMapping: { select: MAPPING_SELECT } },
      });
      const current: CurrentDefinition[] = rows.map((row) => ({
        metricKey: row.metricKey,
        strategicAreaId: row.strategicAreaId ?? null,
        target: row.target ?? null,
        mapping: (row.measureMapping as MappingState | null) ?? null,
      }));
      const plan = planRevert(snapshotBody, current);
      if (plan.drift.length > 0) return { applied: 0, drift: plan.drift, restores: [] as string[] };
      // `planRevert` only plans a restore for a definition it found in the state
      // it was given, so every key below is present and reads back by metricKey.
      for (const restore of plan.restores) {
        const definition = await tx.kpiDefinition.findUniqueOrThrow({ where: { metricKey: restore.metricKey }, select: { id: true } });
        if (restore.kind === "link-definition") {
          await tx.kpiDefinition.update({ where: { id: definition.id }, data: { strategicAreaId: restore.toAreaId } });
        } else if (restore.kind === "set-target-text") {
          await tx.kpiDefinition.update({ where: { id: definition.id }, data: { target: restore.to } });
        } else if (restore.kind === "delete-mapping") {
          await tx.kpiMeasureMapping.deleteMany({ where: { measureKpiId: definition.id } });
        } else {
          await tx.kpiMeasureMapping.update({ where: { measureKpiId: definition.id }, data: { ...restore.to } });
        }
      }
      return { applied: plan.restores.length, drift: [], restores: plan.restores.map(describeRestore) };
    },
    { isolationLevel: "Serializable" },
  );

  if (result.drift.length > 0) {
    console.log(JSON.stringify({ reverted: false, snapshot: SNAPSHOT, drift: result.drift }, null, 2));
    console.error("Refusing to revert: production configuration changed after this snapshot was taken. Nothing was written. Review the drift above and revert by hand if that is intended.");
    process.exitCode = 3;
    return;
  }
  console.log(JSON.stringify({ revertedFrom: SNAPSHOT, restoresApplied: result.applied, restores: result.restores }, null, 2));
}

async function main() {
  if (REVERT) {
    await revert();
    return;
  }
  const pillars = await loadPillars();
  const plan = planOctoberConfiguration(pillars);
  const summary = {
    mode: APPLY ? "APPLY" : "DRY RUN (no writes; pass --apply after engineering approval)",
    pillars: plan.pillars,
    changes: plan.changes.map(describeChange),
    issues: plan.issues,
    notes: plan.notes,
  };
  console.log(JSON.stringify(summary, null, 2));
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
  // Snapshot first, so the run is reversible even if a later statement fails.
  // It records both what was found and what the plan will leave behind, which is
  // what lets --revert refuse to overwrite a newer configuration.
  const path = await snapshot(pillars, expectedAfter(pillars, plan.changes));
  await prisma.$transaction(async (tx) => {
    // Guard against a concurrent change: re-read the active mappings inside the
    // transaction. A pillar that already has more than one active mapping is
    // ambiguous, and this script must not pick one for it.
    for (const pillar of plan.pillars) {
      const area = pillars.find((candidate) => candidate.code === pillar.pillar);
      if (!area) continue;
      const active = await tx.kpiMeasureMapping.count({ where: { active: true, measureKpi: { metricKey: { in: area.definitions.map((d) => d.metricKey) } } } });
      if (active > 1) throw new Error(`Refusing to write: ${pillar.pillar} already has ${active} active mappings. Resolve that on Admin > Measure mappings first.`);
    }
    await applyChanges(tx, pillars, plan.changes);
  });
  console.log(JSON.stringify({ applied: plan.changes.length, snapshot: path }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
