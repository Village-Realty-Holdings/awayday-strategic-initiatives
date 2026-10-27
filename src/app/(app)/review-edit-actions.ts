"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { str, lines } from "@/lib/form";
import { audit } from "@/lib/audit";
import { getActivePlan } from "@/lib/active-plan";
import { getReviewPlan } from "@/lib/review-data";
import { requireEditor } from "@/lib/session";
import { isoDay, parseIsoDay, parseSoWhats, PERIOD_PATTERN, SI_REVIEW_STATUSES, SUMMARY_SCOPE, type SiReviewStatus } from "@/lib/review-model";

// ---------------------------------------------------------------------------
// Edit Mode on the Strategy Review (admins and editors). Each dialog saves one
// section and gets a result back instead of a redirect, so it can close or
// show the error in place; revalidatePath re-renders the review underneath.
// ---------------------------------------------------------------------------

export type EditResult = { ok: true } | { ok: false; error: string };

const LOCKED: EditResult = { ok: false, error: "This month is published. Unpublish it on the review editor to make changes." };

function revalidateReview() {
  revalidatePath("/", "layout");
}

function periodId(fd: FormData): string | null {
  const id = str(fd, "periodId");
  return id && PERIOD_PATTERN.test(id) ? id : null;
}

async function isPublished(id: string): Promise<boolean> {
  const row = await prisma.reviewPeriod.findUnique({ where: { id }, select: { status: true } });
  return row?.status === "PUBLISHED";
}

/** Strategy-house roof (mission, goal, values) of the active plan. */
export async function editPlanHeader(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  const plan = await getActivePlan();
  if (!plan || plan.id !== str(fd, "planVersionId")) return { ok: false, error: "The active plan has changed. Reload the page and try again." };
  const before = await prisma.planVersion.findUnique({ where: { id: plan.id }, select: { mission: true, goal: true, values: true } });
  const after = {
    mission: str(fd, "mission")?.slice(0, 300) ?? null,
    goal: str(fd, "goal")?.slice(0, 300) ?? null,
    values: lines(fd, "values", 12).map((v) => v.slice(0, 80)),
  };
  await prisma.planVersion.update({ where: { id: plan.id }, data: after });
  await audit(session.user.id, "UPDATE", "PlanVersion", plan.id, { before, after });
  revalidateReview();
  return { ok: true };
}

/** The month's header: prepared by, meeting date, updates due and data as of. */
export async function editReviewDetails(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  const id = periodId(fd);
  if (!id) return { ok: false, error: "Unknown review month." };
  const existing = await prisma.reviewPeriod.findUnique({
    where: { id },
    select: { status: true, preparedBy: true, meetingDate: true, updatesDueDate: true, dataAsOf: true },
  });
  if (existing?.status === "PUBLISHED") return LOCKED;
  const fields = {
    preparedBy: str(fd, "preparedBy")?.slice(0, 120) ?? null,
    meetingDate: parseIsoDay(str(fd, "meetingDate")),
    updatesDueDate: parseIsoDay(str(fd, "updatesDueDate")),
    dataAsOf: parseIsoDay(str(fd, "dataAsOf")),
  };
  await prisma.reviewPeriod.upsert({ where: { id }, create: { id, ...fields }, update: fields });
  const days = (p: typeof fields) => ({ preparedBy: p.preparedBy, meetingDate: isoDay(p.meetingDate), updatesDueDate: isoDay(p.updatesDueDate), dataAsOf: isoDay(p.dataAsOf) });
  await audit(session.user.id, existing ? "UPDATE" : "CREATE", "ReviewPeriod", id, { before: existing ? days(existing) : undefined, after: days(fields) });
  revalidateReview();
  return { ok: true };
}

/**
 * Replace the so-whats of one scope (the summary or one area of the active
 * plan) for the month. Saving creates the month as a draft if it isn't stored.
 */
export async function editSoWhats(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  const id = periodId(fd);
  const scope = str(fd, "scope");
  if (!id || !scope) return { ok: false, error: "Unknown review month." };
  const existing = await prisma.reviewPeriod.findUnique({
    where: { id },
    select: { status: true, soWhats: { where: { scope }, orderBy: { order: "asc" }, select: { headline: true } } },
  });
  if (existing?.status === "PUBLISHED") return LOCKED;
  const plan = await getReviewPlan(id);
  if (scope !== SUMMARY_SCOPE && !plan.areas.some((a) => a.code === scope)) return { ok: false, error: "That pillar is not in the active plan." };
  const soWhats = parseSoWhats(str(fd, "soWhats"), [scope]);

  await prisma.$transaction([
    prisma.reviewPeriod.upsert({ where: { id }, create: { id, preparedBy: session.user.name }, update: {} }),
    prisma.reviewSoWhat.deleteMany({ where: { periodId: id, scope } }),
    prisma.reviewSoWhat.createMany({ data: soWhats.map((s) => ({ periodId: id, ...s })) }),
  ]);
  await audit(session.user.id, "UPDATE", "ReviewSoWhat", `${id}:${scope}`, {
    before: existing?.soWhats.map((s) => s.headline) ?? [],
    after: soWhats.map((s) => s.headline),
  });
  revalidateReview();
  return { ok: true };
}

/** A pillar or enabler of the active plan: name, objective and owner. */
export async function editStrategicArea(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  const plan = await getActivePlan();
  const id = str(fd, "areaId") ?? "";
  const before = await prisma.strategicArea.findUnique({ where: { id }, select: { planVersionId: true, name: true, goal: true, owner: true } });
  if (!plan || !before || before.planVersionId !== plan.id) return { ok: false, error: "That pillar is not in the active plan." };
  const name = str(fd, "name")?.slice(0, 120);
  if (!name) return { ok: false, error: "Give the pillar a name." };
  const after = { name, goal: str(fd, "goal")?.slice(0, 1000) ?? null, owner: str(fd, "owner")?.slice(0, 200) ?? null };
  await prisma.strategicArea.update({ where: { id }, data: after });
  await audit(session.user.id, "UPDATE", "StrategicArea", id, { before: { name: before.name, goal: before.goal, owner: before.owner }, after });
  revalidateReview();
  return { ok: true };
}

/**
 * An SI's update for the month (status, latest progress, what next), stored as
 * a new InitiativeUpdate like the ones leads save on My SIs. The month's
 * next-milestone fields carry over from its latest update.
 */
export async function editSiUpdate(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  const id = periodId(fd);
  const initiativeId = str(fd, "initiativeId") ?? "";
  if (!id) return { ok: false, error: "Unknown review month." };
  if (await isPublished(id)) return LOCKED;
  const initiative = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { id: true, status: true, updates: { where: { reportingPeriod: id }, orderBy: { createdAt: "desc" }, take: 1, select: { nextMilestone: true, milestoneDueAt: true } } },
  });
  if (!initiative) return { ok: false, error: "That SI no longer exists." };
  const rawStatus = str(fd, "reviewStatus");
  const reviewStatus = SI_REVIEW_STATUSES.includes(rawStatus as SiReviewStatus) ? (rawStatus as SiReviewStatus) : null;
  const previous = initiative.updates[0];
  const created = await prisma.initiativeUpdate.create({
    data: {
      initiativeId,
      status: initiative.status,
      reviewStatus,
      update: str(fd, "update"),
      pathForward: str(fd, "pathForward"),
      nextMilestone: previous?.nextMilestone ?? null,
      milestoneDueAt: previous?.milestoneDueAt ?? null,
      reportingPeriod: id,
      updatedBy: session.user.name,
    },
  });
  await audit(session.user.id, "CREATE", "InitiativeUpdate", created.id, { after: { initiativeId, reviewStatus, reportingPeriod: id } });
  revalidateReview();
  return { ok: true };
}
