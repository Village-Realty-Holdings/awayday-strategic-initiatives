import "dotenv/config";
import { writeFile, readFile } from "node:fs/promises";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  OCTOBER_PRIMARY_CONFIG,
  describeChange,
  planOctoberConfiguration,
  type DefinitionState,
  type MappingState,
  type PillarState,
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
    where: { metricKey: { in: reviewedKeys }, NOT: { strategicAreaId: { in: areas.map((area) => area.id) } } },
    select: { id: true, metricKey: true, name: true, strategicAreaId: true, target: true, measureMapping: { select: MAPPING_SELECT } },
  });

  return codes.map((code) => {
    const area = areas.find((candidate) => candidate.code === code);
    if (!area) return { code, areaId: "", definitions: [] };
    const definitions: DefinitionState[] = [...area.kpis, ...unlinked.filter((definition) => reviewedKeys.includes(definition.metricKey))].map((definition) => ({
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

async function snapshot(pillars: readonly PillarState[]) {
  const state = pillars.map((pillar) => ({
    code: pillar.code,
    areaId: pillar.areaId,
    definitions: pillar.definitions.map((definition) => ({
      metricKey: definition.metricKey,
      strategicAreaId: definition.strategicAreaId,
      target: definition.target,
      mapping: definition.mapping,
    })),
  }));
  await writeFile(SNAPSHOT, `${JSON.stringify({ capturedAt: new Date().toISOString(), pillars: state }, null, 2)}\n`, "utf8");
  return SNAPSHOT;
}

async function revert() {
  const raw = JSON.parse(await readFile(SNAPSHOT, "utf8")) as {
    pillars: { code: string; areaId: string; definitions: { metricKey: string; strategicAreaId: string | null; target: string | null; mapping: MappingState | null }[] }[];
  };
  let restored = 0;
  for (const pillar of raw.pillars) {
    for (const definition of pillar.definitions) {
      const row = await prisma.kpiDefinition.findUnique({ where: { metricKey: definition.metricKey }, select: { id: true } });
      if (!row) continue;
      await prisma.kpiDefinition.update({ where: { id: row.id }, data: { strategicAreaId: definition.strategicAreaId, target: definition.target } });
      if (definition.mapping === null) {
        await prisma.kpiMeasureMapping.deleteMany({ where: { measureKpiId: row.id } });
      } else {
        const { active, calculation, inputMetricKey, denominatorMetricKey, timeBasis, displayFormat, higherIsBetter, targetBudget, targetStretch } = definition.mapping;
        await prisma.kpiMeasureMapping.upsert({
          where: { measureKpiId: row.id },
          update: { active, calculation, inputMetricKey, denominatorMetricKey, timeBasis, displayFormat, higherIsBetter, targetBudget, targetStretch },
          create: { measureKpiId: row.id, active, calculation, inputMetricKey, denominatorMetricKey, timeBasis, displayFormat, higherIsBetter, targetBudget, targetStretch },
        });
      }
      restored++;
    }
  }
  console.log(JSON.stringify({ revertedFrom: SNAPSHOT, definitionsRestored: restored }, null, 2));
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
  const path = await snapshot(pillars);
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
