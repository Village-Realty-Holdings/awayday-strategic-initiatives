"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireSession, canEdit } from "@/lib/session";
import { BELOW_LINE_STATUSES, initiativeOwnerMatches, PERIOD_PATTERN, SI_REVIEW_STATUSES, type SiReviewStatus } from "@/lib/review-model";

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parsedDate(formData: FormData, key: string): Date | null {
  const value = text(formData, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidateReview() {
  revalidatePath("/", "layout");
}

/** An SI lead's monthly update: review status, latest progress and what next. */
export async function saveInitiativeUpdate(formData: FormData) {
  const session = await requireSession();
  const initiativeId = String(formData.get("initiativeId") ?? "");
  const initiative = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { id: true, status: true, ownerUserId: true, teamLead: true },
  });
  if (!initiative) redirect("/my");
  if (!canEdit(session.user.role) && !initiativeOwnerMatches(initiative, session.user)) redirect("/my");

  const rawStatus = text(formData, "reviewStatus");
  const reviewStatus = SI_REVIEW_STATUSES.includes(rawStatus as SiReviewStatus) ? (rawStatus as SiReviewStatus) : null;
  const period = text(formData, "reportingPeriod");
  const created = await prisma.initiativeUpdate.create({
    data: {
      initiativeId,
      // Lifecycle status is copied, not changed: the review status is separate.
      status: initiative.status,
      reviewStatus,
      update: text(formData, "update"),
      pathForward: text(formData, "pathForward"),
      nextMilestone: text(formData, "nextMilestone"),
      milestoneDueAt: parsedDate(formData, "milestoneDueAt"),
      reportingPeriod: period && PERIOD_PATTERN.test(period) ? period : null,
      updatedBy: session.user.name,
    },
  });
  await audit(session.user.id, "CREATE", "InitiativeUpdate", created.id, { after: { initiativeId, reviewStatus, reportingPeriod: created.reportingPeriod } });
  revalidateReview();
  redirect(`/my${period ? `?period=${encodeURIComponent(period)}` : ""}#si-${initiativeId}`);
}

export async function toggleActionItem(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const item = await prisma.initiativeActionItem.findUnique({
    where: { id },
    select: { id: true, status: true, owner: true, initiative: { select: { ownerUserId: true, teamLead: true } } },
  });
  if (!item) return;
  if (!canEdit(session.user.role) && item.owner !== session.user.name && !initiativeOwnerMatches(item.initiative, session.user)) return;
  const status = item.status === "DONE" ? "OPEN" : "DONE";
  await prisma.initiativeActionItem.update({ where: { id }, data: { status } });
  await audit(session.user.id, "UPDATE", "InitiativeActionItem", id, { before: { status: item.status }, after: { status } });
  revalidateReview();
}

export async function toggleMilestone(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const milestone = await prisma.initiativeMilestone.findUnique({
    where: { id },
    select: { id: true, completedAt: true, owner: true, initiative: { select: { ownerUserId: true, teamLead: true } } },
  });
  if (!milestone) return;
  if (!canEdit(session.user.role) && milestone.owner !== session.user.name && !initiativeOwnerMatches(milestone.initiative, session.user)) return;
  const completedAt = milestone.completedAt ? null : new Date();
  await prisma.initiativeMilestone.update({ where: { id }, data: { completedAt } });
  await audit(session.user.id, "UPDATE", "InitiativeMilestone", id, { before: { completedAt: milestone.completedAt }, after: { completedAt } });
  revalidateReview();
}

export async function createBelowLineProject(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.user.role)) redirect("/below-the-line");
  const strategicAreaId = String(formData.get("strategicAreaId") ?? "");
  const name = text(formData, "name");
  if (!name) redirect("/below-the-line");
  const area = await prisma.strategicArea.findUnique({ where: { id: strategicAreaId }, select: { id: true } });
  if (!area) redirect("/below-the-line");
  const initiativeId = text(formData, "initiativeId");
  if (initiativeId) {
    const initiative = await prisma.initiative.findFirst({ where: { id: initiativeId, strategicAreaId }, select: { id: true } });
    if (!initiative) redirect("/below-the-line");
  }
  const rawStatus = String(formData.get("status") ?? "");
  const created = await prisma.belowLineProject.create({
    data: {
      strategicAreaId,
      name,
      description: text(formData, "description"),
      owner: text(formData, "owner"),
      team: text(formData, "team"),
      status: BELOW_LINE_STATUSES.includes(rawStatus as (typeof BELOW_LINE_STATUSES)[number]) ? rawStatus : "NOT_STARTED",
      dueAt: parsedDate(formData, "dueAt"),
      initiativeId,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });
  await audit(session.user.id, "CREATE", "BelowLineProject", created.id, { after: { strategicAreaId, name, initiativeId } });
  revalidatePath("/below-the-line");
  redirect("/below-the-line");
}
