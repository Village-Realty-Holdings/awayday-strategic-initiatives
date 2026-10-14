import { createHash } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FY27_PLAN, type Fy27Initiative } from "../src/lib/fy27-plan";

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("Set DIRECT_URL to the target Postgres connection string.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

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
    }

    let created = 0;
    let updated = 0;
    for (const item of FY27_PLAN.initiatives as readonly Fy27Initiative[]) {
      const areaId = areas.get(item.areaCode);
      if (!areaId) throw new Error(`Missing strategic area ${item.areaCode}`);

      const existing = await tx.initiative.findUnique({ where: { code: item.code }, select: { id: true } });
      const data = {
        name: item.name,
        planVersionId: plan.id,
        strategicAreaId: areaId,
        sourceKey: item.sourceKey,
        sourceManaged: true,
        cimDriver: item.areaCode,
        teamLead: item.owner,
        secondaryLead: item.sponsor,
        problem: item.objective,
        valueWhenComplete: item.objective,
        quantMetric: item.valueMetric,
        quantTarget: item.valueTarget,
      };

      if (existing) {
        await tx.initiative.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        const createdInitiative = await tx.initiative.create({
          data: {
            code: item.code,
            ...data,
            status: item.status,
            value: 3,
            lift: 3,
            quadrant: "FILL_IN",
            pctComplete: 0,
          },
        });
        if (item.milestones) {
          await tx.initiativeMilestone.createMany({
            data: item.milestones.map((milestone, order) => ({
              initiativeId: createdInitiative.id,
              title: milestone.title,
              owner: milestone.owner,
              dueAt: milestone.dueAt ? new Date(milestone.dueAt) : null,
              order,
            })),
          });
        }
        created++;
      }
    }

    const run = await tx.importRun.create({
      data: {
        planVersionId: plan.id,
        sourceFileName: FY27_PLAN.sourceFileName,
        sourceHash,
        status: "CONFIRMED",
        summary: { created, updated, unchanged: 0, flagged: 0, conflicts: 0 },
        warnings: ["Some deck fields are explicitly TBD or blank and remain visible as TBD."],
      },
    });

    return { plan: plan.code, run: run.id, created, updated };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
