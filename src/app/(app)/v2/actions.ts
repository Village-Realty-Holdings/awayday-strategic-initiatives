"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireSession, canEdit } from "@/lib/session";
import { BELOW_LINE_STATUSES, initiativeOwnerMatches, V2_UPDATE_STATUSES } from "@/lib/v2-data";
import type { InitiativeStatus } from "@/generated/prisma/client";

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

export async function saveV2InitiativeUpdate(formData: FormData) {
  const session = await requireSession();
  const initiativeId = String(formData.get("initiativeId") ?? "");
  const initiative = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { id: true, code: true, status: true, ownerUserId: true, teamLead: true },
  });
  if (!initiative) redirect("/v2");
  if (!canEdit(session.user.role) && !initiativeOwnerMatches(initiative, session.user)) redirect(`/v2/si/${initiative.code}`);

  const rawStatus = String(formData.get("status") ?? initiative.status);
  const status = (V2_UPDATE_STATUSES.includes(rawStatus as (typeof V2_UPDATE_STATUSES)[number]) ? rawStatus : initiative.status) as InitiativeStatus;
  const created = await prisma.initiativeUpdate.create({
    data: {
      initiativeId,
      status,
      update: text(formData, "update"),
      pathForward: text(formData, "pathForward"),
      nextMilestone: text(formData, "nextMilestone"),
      milestoneDueAt: parsedDate(formData, "milestoneDueAt"),
      reportingPeriod: text(formData, "reportingPeriod"),
      updatedBy: session.user.name,
    },
  });
  await prisma.initiative.update({ where: { id: initiativeId }, data: { status } });
  await audit(session.user.id, "CREATE", "InitiativeUpdate", created.id, { after: { initiativeId, status } });
  revalidatePath("/v2");
  revalidatePath("/v2/inbox");
  revalidatePath(`/v2/si/${initiative.code}`);
  redirect(`/v2/si/${initiative.code}`);
}

export async function toggleV2ActionItem(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const item = await prisma.initiativeActionItem.findUnique({ where: { id }, select: { id: true, initiativeId: true, status: true, owner: true, initiative: { select: { code: true, ownerUserId: true, teamLead: true } } } });
  if (!item) return;
  if (!canEdit(session.user.role) && item.owner !== session.user.name && item.initiative.ownerUserId !== session.user.id && item.initiative.teamLead !== session.user.name) return;
  const status = item.status === "DONE" ? "OPEN" : "DONE";
  await prisma.initiativeActionItem.update({ where: { id }, data: { status } });
  revalidatePath("/v2/inbox");
  revalidatePath(`/v2/si/${item.initiative.code}`);
}

export async function toggleV2Milestone(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const milestone = await prisma.initiativeMilestone.findUnique({ where: { id }, select: { id: true, initiativeId: true, completedAt: true, owner: true, initiative: { select: { code: true, ownerUserId: true, teamLead: true } } } });
  if (!milestone || (!canEdit(session.user.role) && milestone.owner !== session.user.name && milestone.initiative.ownerUserId !== session.user.id && milestone.initiative.teamLead !== session.user.name)) return;
  await prisma.initiativeMilestone.update({ where: { id }, data: { completedAt: milestone.completedAt ? null : new Date() } });
  revalidatePath("/v2/inbox");
  revalidatePath(`/v2/si/${milestone.initiative.code}`);
}

export async function createBelowLineProject(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.user.role)) redirect("/v2/below-the-line");
  const strategicAreaId = String(formData.get("strategicAreaId") ?? "");
  const name = text(formData, "name");
  if (!name) redirect("/v2/below-the-line");
  const area = await prisma.strategicArea.findUnique({ where: { id: strategicAreaId }, select: { id: true } });
  if (!area) redirect("/v2/below-the-line");
  const initiativeId = text(formData, "initiativeId");
  if (initiativeId) {
    const initiative = await prisma.initiative.findFirst({ where: { id: initiativeId, strategicAreaId }, select: { id: true } });
    if (!initiative) redirect("/v2/below-the-line");
  }
  await prisma.belowLineProject.create({
    data: {
      strategicAreaId,
      name,
      description: text(formData, "description"),
      owner: text(formData, "owner"),
      team: text(formData, "team"),
      status: BELOW_LINE_STATUSES.includes(String(formData.get("status")) as (typeof BELOW_LINE_STATUSES)[number]) ? String(formData.get("status")) : "NOT_STARTED",
      dueAt: parsedDate(formData, "dueAt"),
      initiativeId,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });
  revalidatePath("/v2/below-the-line");
  redirect("/v2/below-the-line");
}
