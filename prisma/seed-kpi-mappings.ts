import "dotenv/config";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL to the target Postgres connection string.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Direction and targets for the five pillar measures, from the FY27 plan. Only
// TRevPAR has an input so far: the others stay on "No data yet" (unless a value is
// entered by hand) until the import publishes their metrics and their
// inputMetricKey is set. Targets are in base units, so M&A's $26M is 26000000.
const MAPPINGS = [
  { area: "M&A", calculation: "DIRECT", inputMetricKey: null, timeBasis: "YTD", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000, targetStretch: 47_000_000 },
  { area: "GROW", calculation: "DIRECT", inputMetricKey: null, timeBasis: "YTD", displayFormat: "percent", higherIsBetter: true, targetBudget: 23, targetStretch: 28 },
  { area: "RETENTION", calculation: "DIRECT", inputMetricKey: null, timeBasis: "LTM", displayFormat: "percent", higherIsBetter: false, targetBudget: 11, targetStretch: 9 },
  { area: "TREVPAR", calculation: "YOY_PCT", inputMetricKey: "trevpar_finance", timeBasis: "YTD", displayFormat: "percent", higherIsBetter: true, targetBudget: 1, targetStretch: 5 },
  { area: "MARGIN", calculation: "RATIO_DELTA_PY", inputMetricKey: null, timeBasis: "YTD", displayFormat: "percent", higherIsBetter: true, targetBudget: 0.25, targetStretch: 1 },
];

async function main() {
  const plan = await prisma.planVersion.findFirst({ where: { active: true }, select: { code: true } });
  if (!plan) throw new Error("No active plan found; import a plan before seeding KPI mappings.");

  let synced = 0;
  const missing: string[] = [];
  for (const { area, ...fields } of MAPPINGS) {
    const metricKey = `${plan.code}:${area}`;
    const kpi = await prisma.kpiDefinition.findUnique({ where: { metricKey }, select: { id: true } });
    if (!kpi) {
      missing.push(metricKey);
      continue;
    }
    await prisma.kpiMeasureMapping.upsert({
      where: { measureKpiId: kpi.id },
      update: fields,
      create: { measureKpiId: kpi.id, ...fields },
    });
    synced++;
  }

  console.log(JSON.stringify({ plan: plan.code, mappingsSynced: synced, missingDefinitions: missing }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
