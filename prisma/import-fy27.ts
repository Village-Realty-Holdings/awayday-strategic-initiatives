import { createHash } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FY27_PLAN, type Fy27Initiative } from "../src/lib/fy27-plan";
import { readDue, splitByWhen } from "../src/lib/charter-rows";

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("Set DIRECT_URL to the target Postgres connection string.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// The charter's status choice, onto the lifecycle status.
const STATUS = { "On track": "IN_PROGRESS", "At risk": "AT_RISK", "Off track": "AT_RISK", "Not started": "NOT_STARTED" } as const;
const DONE = /^(done|complete|completed)$/i;

/**
 * The deck is the source for an SI's risks, dependencies and milestones: each
 * import replaces them. Completion carries over by title, so a milestone or
 * dependency someone ticked off stays done. A milestone due "Done" is done.
 */
async function replaceCharterTables(tx: Tx, initiativeId: string, item: Fy27Initiative) {
  const [oldMilestones, oldDeps] = await Promise.all([
    tx.initiativeMilestone.findMany({ where: { initiativeId }, select: { title: true, completedAt: true } }),
    tx.initiativeActionItem.findMany({ where: { initiativeId, kind: "DEPENDENCY" }, select: { title: true, status: true } }),
  ]);
  const completed = new Map(oldMilestones.map((m) => [m.title, m.completedAt]));
  const depStatus = new Map(oldDeps.map((d) => [d.title, d.status]));

  await tx.initiativeRisk.deleteMany({ where: { initiativeId } });
  await tx.initiativeActionItem.deleteMany({ where: { initiativeId, kind: "DEPENDENCY" } });
  await tx.initiativeMilestone.deleteMany({ where: { initiativeId } });

  await tx.initiativeRisk.createMany({
    data: item.risks.map((r, order) => ({ initiativeId, risk: r.risk, mitigation: r.mitigation, owner: r.owner, order })),
  });
  await tx.initiativeActionItem.createMany({
    data: item.dependencies.map((d, order) => ({
      initiativeId,
      kind: "DEPENDENCY",
      title: d.need,
      owner: d.fromWhom ?? "",
      ...splitByWhen(d.byWhen),
      status: depStatus.get(d.need) ?? "OPEN",
      order,
    })),
  });
  await tx.initiativeMilestone.createMany({
    data: item.milestones.map((m, order) => ({
      initiativeId,
      title: m.title,
      owner: m.owner,
      dueAt: readDue(m.due)?.date ?? null,
      completedAt: completed.get(m.title) ?? (m.due && DONE.test(m.due.trim()) ? new Date() : null),
      order,
    })),
  });
}

const sourceHash = createHash("sha256")
  .update(JSON.stringify(FY27_PLAN))
  .digest("hex");

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const legacy = await tx.planVersion.upsert({
      where: { code: "FY26" },
      update: { active: false },
      create: { code: "FY26", title: "Awayday Strategic Initiatives — FY26", active: false },
    });

    await tx.initiative.updateMany({
      where: { planVersionId: null },
      data: { planVersionId: legacy.id },
    });

    await tx.planVersion.updateMany({ data: { active: false } });
    const plan = await tx.planVersion.upsert({
      where: { code: FY27_PLAN.code },
      update: {
        title: FY27_PLAN.title,
        sourceFileName: FY27_PLAN.sourceFileName,
        sourceHash,
        active: true,
        importedAt: new Date(),
      },
      create: {
        code: FY27_PLAN.code,
        title: FY27_PLAN.title,
        sourceFileName: FY27_PLAN.sourceFileName,
        sourceHash,
        active: true,
        importedAt: new Date(),
      },
    });

    const areas = new Map<string, string>();
    for (const area of FY27_PLAN.areas) {
      const row = await tx.strategicArea.upsert({
        where: { planVersionId_code: { planVersionId: plan.id, code: area.code } },
        update: {
          kind: area.kind,
          name: area.name,
          goal: area.goal,
          kpiName: area.kpiName,
          kpiTarget: area.kpiTarget,
          owner: area.owner,
          order: area.order,
        },
        create: {
          planVersionId: plan.id,
          kind: area.kind,
          code: area.code,
          name: area.name,
          goal: area.goal,
          kpiName: area.kpiName,
          kpiTarget: area.kpiTarget,
          owner: area.owner,
          order: area.order,
        },
      });
      areas.set(area.code, row.id);

      if (area.kpiName?.trim()) {
        const metricKey = `${FY27_PLAN.code}:${area.code}`;
        await tx.kpiDefinition.upsert({
          where: { metricKey },
          update: {
            name: area.kpiName,
            target: area.kpiTarget ?? null,
            strategicAreaId: row.id,
          },
          create: {
            metricKey,
            name: area.kpiName,
            target: area.kpiTarget ?? null,
            sourceType: "MANUAL",
            strategicAreaId: row.id,
          },
        });
      }
    }

    const sourceKeys = new Set(FY27_PLAN.initiatives.map((item) => item.sourceKey));
    const stale = await tx.initiative.findMany({
      where: {
        planVersionId: plan.id,
        sourceManaged: true,
        sourceKey: { notIn: [...sourceKeys] },
      },
      select: { id: true, code: true, name: true },
    });
    if (stale.length > 0) {
      for (const item of stale) {
        await tx.$executeRawUnsafe('DELETE FROM "Attachment" WHERE "initiativeId" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "InitiativeActionItem" WHERE "initiativeId" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "InitiativeComment" WHERE "initiativeId" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "InitiativeEltRequest" WHERE "initiativeId" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "InitiativeMilestone" WHERE "initiativeId" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "InitiativeRisk" WHERE "initiativeId" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "RiskInitiative" WHERE "initiativeId" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "SubInitiative" WHERE "initiativeId" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "_InitiativeToInitiativeGroup" WHERE "A" = $1', item.id);
        await tx.$executeRawUnsafe('DELETE FROM "InitiativeUpdate" WHERE "initiativeId" = $1', item.id);
      }
      await tx.initiative.deleteMany({ where: { id: { in: stale.map((item) => item.id) } } });
    }

    let created = 0;
    let updated = 0;
    const warnings: string[] = [];
    for (const item of FY27_PLAN.initiatives) {
      const areaId = areas.get(item.areaCode);
      if (!areaId) throw new Error(`Missing strategic area ${item.areaCode}`);

      const existing = await tx.initiative.findUnique({ where: { code: item.code }, select: { id: true } });
      // A null objective (a placeholder slide) keeps what's stored; other blank
      // cells are written as blank. An unmarked status leaves the status alone.
      const data = {
        name: item.name,
        planVersionId: plan.id,
        strategicAreaId: areaId,
        sourceKey: item.sourceKey,
        sourceManaged: true,
        cimDriver: item.areaCode,
        teamLead: item.siLead,
        secondaryLead: item.eltSponsor,
        valueWhenComplete: item.objective ?? undefined,
        quantMetric: item.metric,
        quantTarget: item.target,
        baseline: item.baseline,
        ebitdaValue: item.ebitdaValue,
        investmentCost: item.investmentCost,
        status: item.status ? STATUS[item.status] : undefined,
      };

      let initiativeId: string;
      if (existing) {
        await tx.initiative.update({ where: { id: existing.id }, data });
        initiativeId = existing.id;
        updated++;
      } else {
        const row = await tx.initiative.create({
          data: { code: item.code, ...data, status: data.status ?? "NOT_STARTED", value: 3, lift: 3, quadrant: "FILL_IN", pctComplete: 0 },
        });
        initiativeId = row.id;
        created++;
      }
      await replaceCharterTables(tx, initiativeId, item);

      const label = `${item.code} ${item.name} (p${item.page})`;
      if (item.notes) warnings.push(`${label}: ${item.notes}`);
      if (item.aopObjective) warnings.push(`${label}: sits under AOP objective "${item.aopObjective}" (not stored).`);
      if (!item.status) warnings.push(`${label}: status not marked on the slide; status left as it was.`);
    }

    const run = await tx.importRun.create({
      data: {
        planVersionId: plan.id,
        sourceFileName: FY27_PLAN.sourceFileName,
        sourceHash,
        status: "CONFIRMED",
        summary: { created, updated, unchanged: 0, flagged: 0, conflicts: 0 },
        warnings: ["Some deck fields are explicitly TBD or blank and remain visible as TBD.", ...warnings],
      },
    });

    return { plan: plan.code, run: run.id, created, updated, removed: stale.length };
  }, { timeout: 30_000 });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
