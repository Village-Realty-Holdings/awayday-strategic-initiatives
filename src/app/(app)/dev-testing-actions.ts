"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { activePlanInitiativeWhere } from "@/lib/active-plan";
import { setDevToday } from "@/lib/clock";
import { buildTestData, isDevTestingEnabled, TEST_MEASURE_PREFIX, TEST_UPDATED_BY } from "@/lib/dev-testing";
import { createBackup, forgetAccount, readRememberedAccount, rememberAccount, restoreBackup } from "@/lib/dev-testing-files";
import { defaultAsOf, derivedPct } from "@/lib/measures";
import { prisma } from "@/lib/prisma";
import { getReviewPeriodIndex } from "@/lib/review-data";
import { openUpdatePeriod, PERIOD_PATTERN, periodLabel, todayIso, updatePeriods } from "@/lib/review-model";
import { requireSession } from "@/lib/session";

// Local testing tool: see lib/dev-testing.ts for the guards. Every action checks
// them first, since a server action can be called without the dialog on screen.

export type DevResult = { ok: boolean; message: string };

const ROLES = ["admin", "editor", "user"];

/** Runs an action only when the tool is on, and reports failures in the dialog. */
async function guarded(run: (session: Awaited<ReturnType<typeof requireSession>>) => Promise<string>): Promise<DevResult> {
  if (!isDevTestingEnabled()) return { ok: false, message: "Dev testing is off." };
  const session = await requireSession();
  try {
    const message = await run(session);
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "That didn't work." };
  }
}

// Percent complete follows measures on value SIs, so it moves when they change.
async function syncValuePercents() {
  const initiatives = await prisma.initiative.findMany({
    where: { valueType: "VALUE" },
    select: { id: true, pctComplete: true, progressActual: true, progressTarget: true, measures: { include: { readings: true } } },
  });
  for (const i of initiatives) {
    const pctComplete = derivedPct(i.progressActual, i.progressTarget, i.measures) ?? 0;
    if (pctComplete !== i.pctComplete) await prisma.initiative.update({ where: { id: i.id }, data: { pctComplete } });
  }
}

export async function devCreateBackup(): Promise<DevResult> {
  return guarded(async () => `Saved ${await createBackup("manual")}.`);
}

export async function devRestoreBackup(name: string): Promise<DevResult> {
  return guarded(async () => {
    const safety = await createBackup("auto");
    await restoreBackup(name);
    return `Restored ${name}. The previous state is saved as ${safety}.`;
  });
}

export async function devSetAccount(role: string, actAs: string): Promise<DevResult> {
  return guarded(async (session) => {
    if (!ROLES.includes(role)) throw new Error("Unknown role.");
    const me = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, name: true, role: true } });
    await rememberAccount(me);
    const original = await readRememberedAccount();
    const name = actAs.trim() || (original?.name ?? me.name);
    await prisma.user.update({ where: { id: me.id }, data: { role, name } });
    await audit(me.id, "UPDATE", "User", me.id, { before: { name: me.name, role: me.role }, after: { name, role } });
    return `You are now ${name}, role ${role}.`;
  });
}

export async function devResetAccount(): Promise<DevResult> {
  return guarded(async (session) => {
    const original = await readRememberedAccount();
    if (!original) return "Your account is unchanged.";
    await prisma.user.update({ where: { id: original.id }, data: { name: original.name, role: original.role } });
    await audit(session.user.id, "UPDATE", "User", original.id, { after: { name: original.name, role: original.role } });
    await forgetAccount();
    return `You are back to ${original.name}.`;
  });
}

export async function devLoadTestData(): Promise<DevResult> {
  return guarded(async (session) => {
    const safety = await createBackup("auto");
    const { periods, published } = await getReviewPeriodIndex();
    const period = openUpdatePeriod(updatePeriods(periods), published);
    const asOf = new Date(`${defaultAsOf(period, todayIso())}T00:00:00Z`);
    const initiatives = await prisma.initiative.findMany({ where: await activePlanInitiativeWhere(), orderBy: { code: "asc" }, select: { id: true } });
    await prisma.initiativeMeasure.deleteMany({ where: { name: { startsWith: TEST_MEASURE_PREFIX } } });
    await prisma.initiativeUpdate.deleteMany({ where: { updatedBy: TEST_UPDATED_BY } });
    for (const plan of buildTestData(initiatives.map((i) => i.id))) {
      if (plan.update) {
        await prisma.initiativeUpdate.create({ data: { initiativeId: plan.initiativeId, ...plan.update, reportingPeriod: period, updatedBy: TEST_UPDATED_BY } });
        await prisma.initiative.update({ where: { id: plan.initiativeId }, data: { status: plan.update.status } });
      }
      if (plan.measure) {
        const { value, ...measure } = plan.measure;
        await prisma.initiativeMeasure.create({
          data: {
            initiativeId: plan.initiativeId,
            ...measure,
            ...(value === null ? {} : { readings: { create: { value, asOf, enteredBy: TEST_UPDATED_BY } } }),
          },
        });
      }
    }
    await syncValuePercents();
    await audit(session.user.id, "CREATE", "DevTesting", period, { after: { action: "load test data", initiatives: initiatives.length } });
    return `Loaded test data for ${periodLabel(period)} on ${initiatives.length} SIs. The previous state is saved as ${safety}.`;
  });
}

export async function devClearUpdates(): Promise<DevResult> {
  return guarded(async (session) => {
    const safety = await createBackup("auto");
    const [updates, measures] = await Promise.all([prisma.initiativeUpdate.deleteMany({}), prisma.initiativeMeasure.deleteMany({})]);
    await syncValuePercents();
    await audit(session.user.id, "DELETE", "DevTesting", "updates", { before: { updates: updates.count, measures: measures.count } });
    return `Removed ${updates.count} updates and ${measures.count} measures. The previous state is saved as ${safety}.`;
  });
}

export async function devSetMonthPublished(period: string, publish: boolean): Promise<DevResult> {
  return guarded(async (session) => {
    if (!PERIOD_PATTERN.test(period)) throw new Error("Unknown month.");
    const data = publish
      ? { status: "PUBLISHED" as const, publishedAt: new Date(), publishedBy: session.user.name }
      : { status: "DRAFT" as const, publishedAt: null, publishedBy: null };
    await prisma.reviewPeriod.upsert({ where: { id: period }, create: { id: period, ...data }, update: data });
    await audit(session.user.id, "UPDATE", "ReviewPeriod", period, { after: { status: data.status } });
    return `${periodLabel(period)} is now ${publish ? "published" : "a draft"}.`;
  });
}

export async function devSetToday(day: string | null): Promise<DevResult> {
  return guarded(async () => {
    if (day !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)))) throw new Error("Pick a valid date.");
    setDevToday(day);
    return day ? `Pretending today is ${day}.` : "Back to the real date.";
  });
}
