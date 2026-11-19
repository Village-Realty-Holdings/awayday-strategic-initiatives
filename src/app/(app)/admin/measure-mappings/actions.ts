"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActivePlan } from "@/lib/active-plan";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { num, pick, str } from "@/lib/form";
import { MAPPING_DISPLAY_FORMATS, MAPPING_TIME_BASES, MEASURE_CALCULATIONS } from "@/lib/kpi-measure-mapping";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const PAGE = "/admin/measure-mappings";

/** Creates or updates the mapping for one measure in the active plan. */
export async function adminSaveMeasureMapping(fd: FormData): Promise<void> {
  const session = await requireSession({ role: "admin" });
  const kpiId = str(fd, "measureKpiId") ?? "";
  const anchor = `#measure-${kpiId}`;
  const fail = (error: string): never => redirect(`${PAGE}?error=${error}${anchor}`);

  const plan = await getActivePlan();
  const measure = await prisma.kpiDefinition.findUnique({
    where: { id: kpiId },
    select: { id: true, name: true, strategicAreaId: true, strategicArea: { select: { planVersionId: true } }, measureMapping: true },
  });
  if (!plan || !measure || measure.strategicArea?.planVersionId !== plan.id) return fail("not-in-plan");
  const before = measure.measureMapping;

  const calculation = pick(fd, "calculation", MEASURE_CALCULATIONS, "DIRECT");
  const isRatio = calculation === "RATIO_DELTA_PY";
  const inputMetricKey = str(fd, "inputMetricKey");
  const denominatorMetricKey = isRatio ? str(fd, "denominatorMetricKey") : null;
  if (isRatio && Boolean(inputMetricKey) !== Boolean(denominatorMetricKey)) return fail("ratio-inputs");

  // Inputs are imported metrics, never another measure. A key already saved stays
  // allowed, because a metric can be mapped before its first import or after removal.
  const chosen = [inputMetricKey, denominatorMetricKey].filter((key): key is string => Boolean(key));
  const unsaved = chosen.filter((key) => key !== before?.inputMetricKey && key !== before?.denominatorMetricKey);
  if (unsaved.length) {
    const valid = await prisma.kpiDefinition.count({ where: { metricKey: { in: unsaved }, strategicAreaId: null } });
    if (valid !== new Set(unsaved).size) return fail("unknown-metric");
  }

  // Direction is tri-state and must be explicit in the request:
  //   HIGHER -> true, LOWER -> false, blank -> null (not stated, colours nothing).
  // An unrecognised value is a bad request, not a silent "higher". Creating a
  // mapping without a direction therefore stores null; it never inherits a
  // default that could colour a rising churn or cost ratio green.
  const direction = str(fd, "direction");
  const higherIsBetter = direction === "HIGHER" ? true : direction === "LOWER" ? false : direction === null ? null : undefined;
  if (higherIsBetter === undefined) return fail("direction");

  const data = {
    calculation,
    inputMetricKey,
    denominatorMetricKey,
    timeBasis: pick(fd, "timeBasis", MAPPING_TIME_BASES, "YTD"),
    // Calculated values are always percentages or percentage points.
    displayFormat: calculation === "DIRECT" ? pick(fd, "displayFormat", MAPPING_DISPLAY_FORMATS, "number") : "percent",
    higherIsBetter,
    targetBudget: num(fd, "targetBudget"),
    targetStretch: num(fd, "targetStretch"),
    active: fd.get("active") === "on",
  };

  // A pillar's primary measure is the KPI with its one active mapping. Refuse to
  // create a second one: two active mappings would make the primary ambiguous.
  // The admin must switch the current mapping off first, which keeps the change
  // deliberate and audited instead of silently re-pointing the headline measure.
  if (data.active && measure.strategicAreaId) {
    const otherPrimary = await prisma.kpiMeasureMapping.count({
      where: { active: true, measureKpiId: { not: measure.id }, measureKpi: { strategicAreaId: measure.strategicAreaId } },
    });
    if (otherPrimary > 0) return fail("primary-exists");
  }
  const saved = await prisma.kpiMeasureMapping.upsert({
    where: { measureKpiId: measure.id },
    update: data,
    create: { measureKpiId: measure.id, ...data },
  });
  await audit(session.user.id, before ? "UPDATE" : "CREATE", "KpiMeasureMapping", saved.id, { before, after: data });

  revalidatePath("/", "layout");
  await flash(`Mapping for "${measure.name}" saved`);
  redirect(`${PAGE}${anchor}`);
}
