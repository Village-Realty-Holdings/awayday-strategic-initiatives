import "dotenv/config";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL to the target Postgres connection string.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const plan = await prisma.planVersion.findFirst({
    where: { active: true },
    select: {
      code: true,
      strategicAreas: {
        select: { id: true, code: true, kpiName: true, kpiTarget: true },
      },
    },
  });
  if (!plan) throw new Error("No active plan found; import a plan before seeding KPI definitions.");

  let synced = 0;
  for (const area of plan.strategicAreas) {
    const name = area.kpiName?.trim();
    if (!name) continue;

    const metricKey = `${plan.code}:${area.code}`;
    await prisma.kpiDefinition.upsert({
      where: { metricKey },
      update: {
        name,
        target: area.kpiTarget ?? null,
        strategicAreaId: area.id,
      },
      create: {
        metricKey,
        name,
        target: area.kpiTarget ?? null,
        sourceType: "MANUAL",
        strategicAreaId: area.id,
      },
    });
    synced++;
  }

  console.log(JSON.stringify({ plan: plan.code, definitionsSynced: synced }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
