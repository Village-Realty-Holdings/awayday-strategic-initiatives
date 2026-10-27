"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { str, date, pick } from "@/lib/form";
import { flash } from "@/lib/flash";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";
import { getActivePlan } from "@/lib/active-plan";
import { deleteAttachment } from "@/lib/storage";
import { quadrantFor, valueFromDollars, effortToLift, parseDollars, type Effort } from "@/lib/initiatives";
import { InitiativeStatus } from "@/generated/prisma/enums";

const STATUSES: string[] = Object.values(InitiativeStatus);
const EFFORTS = ["S", "M", "L"];

// Money inputs may carry "$", commas, "M"/"K" — normalize to a plain number.
function money(fd: FormData, key: string): number | null {
  return parseDollars(str(fd, key));
}

// Only persist a cimItemCode that matches a real CIM risk; otherwise drop it.
// (The form constrains the picker, but the server must not trust the client.)
async function validCimItemCode(code: string | null): Promise<string | null> {
  if (!code) return null;
  const r = await prisma.cimRisk.findUnique({ where: { code }, select: { code: true } });
  return r ? code : null;
}

// The Area picker is optional, but the server must not trust the client: the
// chosen area has to belong to the plan the initiative sits in. Returns the id
// if valid, else null (callers treat a non-empty-but-invalid choice as an error).
async function validAreaId(areaId: string | null, planId: string | null): Promise<string | null> {
  if (!areaId || !planId) return null;
  const a = await prisma.strategicArea.findFirst({ where: { id: areaId, planVersionId: planId }, select: { id: true } });
  return a ? a.id : null;
}

// Editable fields shared by create + update. Scoring is derived: Value from the
// Targeted Value ($) band, Lift from the Small/Medium/Large effort picker. The
// CIM driver is the organizing link (board theme retired). Removed inputs
// (DMAIC stage, quality impact, out-of-scope, milestones) are intentionally NOT
// written here so legacy column data is preserved untouched.
function parseFields(fd: FormData) {
  const statusRaw = String(fd.get("status") ?? "");
  const status = (STATUSES.includes(statusRaw) ? statusRaw : "NOT_STARTED") as InitiativeStatus;
  const effortRaw = String(fd.get("effort") ?? "M");
  const effort = (EFFORTS.includes(effortRaw) ? effortRaw : "M") as Effort;

  const valueType = String(fd.get("valueType") ?? "VALUE") === "NON_VALUE" ? "NON_VALUE" : "VALUE";
  const isValue = valueType === "VALUE";

  // Non-value initiatives carry no dollars; completion is driven by status.
  const targetedValue = isValue ? money(fd, "targetedValue") : null; // annualized $ value created when complete
  const valueRealized = isValue ? money(fd, "valueRealized") : null; // $ value realized so far
  const value = valueFromDollars(targetedValue); // 3 (neutral) when no targeted $
  const lift = effortToLift(effort);

  // % complete: for value initiatives it's value realized ÷ targeted (may exceed
  // 100%); for non-value it's status-driven (Done = 100%, else 0%).
  let pct = 0;
  if (isValue) {
    if (targetedValue && targetedValue > 0 && valueRealized != null) pct = Math.max(0, valueRealized / targetedValue);
  } else {
    pct = status === "DONE" ? 1 : 0;
  }

  return {
    name: str(fd, "name") ?? "Untitled initiative",
    cimDriver: str(fd, "cimDriver"),
    cimItemCode: str(fd, "cimItemCode"),
    valueType,
    teamLead: str(fd, "teamLead"),
    secondaryLead: str(fd, "secondaryLead"),
    supports: str(fd, "supports"),
    valueWhenComplete: str(fd, "valueWhenComplete"),
    workRequired: str(fd, "workRequired"),
    value,
    lift,
    quadrant: quadrantFor(value, lift),
    status,
    pctComplete: pct,
    progressTarget: targetedValue,
    progressActual: valueRealized,
    quantMetric: str(fd, "quantMetric"),
    quantTarget: str(fd, "quantTarget"),
    startDate: date(fd, "startDate"),
    endDate: date(fd, "endDate"),
  };
}


export async function updateInitiative(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const expectedUpdatedAt = String(formData.get("updatedAt"));

  const before = await prisma.initiative.findUnique({ where: { id } });
  if (!before) redirect("/admin/initiatives");

  // Optimistic concurrency: someone else saved since this form was loaded.
  if (before.updatedAt.toISOString() !== expectedUpdatedAt) {
    redirect(`/admin/initiatives/${id}/edit?conflict=1`);
  }

  const data: ReturnType<typeof parseFields> & { strategicAreaId?: string | null; planVersionId?: string } = parseFields(formData);
  data.cimItemCode = await validCimItemCode(data.cimItemCode);
  // Area: validated against the initiative's own plan (or the active plan for a
  // legacy initiative with none, which then joins that plan). An empty choice
  // clears the area. Skipped entirely when the form didn't submit the field.
  if (formData.has("strategicAreaId")) {
    const planId = before.planVersionId ?? (await getActivePlan())?.id ?? null;
    const chosenArea = str(formData, "strategicAreaId");
    const areaId = await validAreaId(chosenArea, planId);
    if (chosenArea && !areaId) redirect(`/admin/initiatives/${id}/edit?error=area`);
    data.strategicAreaId = areaId;
    if (areaId && !before.planVersionId && planId) data.planVersionId = planId;
  }
  const after = await prisma.initiative.update({ where: { id }, data });
  await audit(session.user.id, "UPDATE", "Initiative", id, { before, after });

  revalidatePath("/admin/initiatives");
  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/");
  revalidatePath("/admin/archive");
  await flash("Initiative saved");
  redirect(`/initiatives/${id}`);
}

export async function createInitiative(formData: FormData) {
  const session = await requireAdmin();
  const code = (str(formData, "code") ?? "").toUpperCase();
  if (!code) redirect("/admin/initiatives/new?error=code");
  const exists = await prisma.initiative.findUnique({ where: { code } });
  if (exists) redirect("/admin/initiatives/new?error=duplicate");

  const fields = parseFields(formData);
  fields.cimItemCode = await validCimItemCode(fields.cimItemCode);
  // New initiatives join the active plan so they show up on the plan-scoped
  // views; the optional area must belong to that plan.
  const activePlan = await getActivePlan();
  const chosenArea = str(formData, "strategicAreaId");
  const strategicAreaId = await validAreaId(chosenArea, activePlan?.id ?? null);
  if (chosenArea && !strategicAreaId) redirect("/admin/initiatives/new?error=area");
  const created = await prisma.initiative.create({
    data: { code, ...fields, planVersionId: activePlan?.id ?? null, strategicAreaId },
  });
  await audit(session.user.id, "CREATE", "Initiative", created.id, { after: created });

  revalidatePath("/admin/initiatives");
  revalidatePath("/");
  revalidatePath("/admin/archive");
  await flash("Initiative created");
  redirect(`/initiatives/${created.id}`);
}

// Inline charter progress update. Percent is purely value created ÷ value to
// create (may exceed 100%); there is no manual percent entry.
export async function updateProgress(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("initiativeId"));
  const before = await prisma.initiative.findUnique({ where: { id } });
  if (!before) redirect("/admin/initiatives");

  // Dollar inputs may carry commas / $ / M-K suffixes.
  const actual = parseDollars(str(formData, "actual"));
  const target = parseDollars(str(formData, "target"));
  // Derive percent from the dollar values (can exceed 100%); keep prior when not both set.
  const pct =
    actual !== null && target !== null && target !== 0
      ? Math.max(0, actual / target)
      : before.pctComplete;

  const after = await prisma.initiative.update({
    where: { id },
    data: { progressActual: actual, progressTarget: target, pctComplete: pct },
  });
  await audit(session.user.id, "UPDATE", "Initiative", id, { before: { pctComplete: before.pctComplete, progressActual: before.progressActual, progressTarget: before.progressTarget }, after: { pctComplete: after.pctComplete, progressActual: after.progressActual, progressTarget: after.progressTarget } });
  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/admin/initiatives");
  revalidatePath("/");
  revalidatePath("/admin/archive");
  await flash("Progress updated");
  redirect(`/initiatives/${id}`);
}

export async function deleteInitiative(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const before = await prisma.initiative.findUnique({ where: { id } });
  if (!before) redirect("/admin/initiatives");
  // Attachment rows cascade with the initiative; their R2 objects don't.
  const files = await prisma.attachment.findMany({
    where: { initiativeId: id, storageKey: { not: null } },
    select: { storageKey: true },
  });

  await prisma.initiative.delete({ where: { id } });
  await Promise.all(files.map((f) => deleteAttachment(f.storageKey!)));
  await audit(session.user.id, "DELETE", "Initiative", id, { before });

  revalidatePath("/admin/initiatives");
  revalidatePath("/");
  revalidatePath("/admin/archive");
  await flash("Initiative deleted");
  redirect("/admin/initiatives");
}

// ---------------------------------------------------------------------------
// Alex's SI punch list (8/31): risk log, dated milestones, dependencies and
// actions with owners, ELT support/investment requests. All per-initiative.

const ACTION_KINDS = ["DEPENDENCY", "ACTION"];
const ELT_KINDS = ["SUPPORT", "INVESTMENT"];
const ELT_STATUSES = ["REQUESTED", "APPROVED", "DECLINED"];


export async function addInitiativeUpdate(formData: FormData) {
  const session = await requireAdmin();
  const initiativeId = String(formData.get("initiativeId"));
  const existing = await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { id: true, status: true } });
  if (!existing) redirect("/admin/initiatives");
  const status = pick(formData, "status", STATUSES, existing.status) as InitiativeStatus;
  const update = str(formData, "update");
  const pathForward = str(formData, "pathForward");
  const nextMilestone = str(formData, "nextMilestone");
  const reportingPeriod = str(formData, "reportingPeriod");
  const milestoneDueAt = date(formData, "milestoneDueAt");
  const created = await prisma.initiativeUpdate.create({
    data: {
      initiativeId,
      status,
      update,
      pathForward,
      nextMilestone,
      milestoneDueAt,
      reportingPeriod,
      updatedBy: session.user.name,
    },
  });
  await prisma.initiative.update({ where: { id: initiativeId }, data: { status } });
  await audit(session.user.id, "CREATE", "InitiativeUpdate", created.id, { after: { initiativeId, status, reportingPeriod } });
  revalidatePath(`/initiatives/${initiativeId}`);
  revalidatePath("/");
  revalidatePath("/admin/archive");
  revalidatePath("/admin/initiatives");
  await flash("Status update saved");
  redirect(`/initiatives/${initiativeId}`);
}

export async function addInitiativeMilestone(formData: FormData) {
  const session = await requireAdmin();
  const initiativeId = String(formData.get("initiativeId"));
  const title = str(formData, "title");
  if (!title) redirect(`/initiatives/${initiativeId}`);
  const count = await prisma.initiativeMilestone.count({ where: { initiativeId } });
  const created = await prisma.initiativeMilestone.create({
    data: { initiativeId, title, owner: str(formData, "owner"), dueAt: date(formData, "dueAt"), order: count },
  });
  await audit(session.user.id, "CREATE", "InitiativeMilestone", created.id, { after: { initiativeId, title } });
  revalidatePath(`/initiatives/${initiativeId}`);
  await flash("Milestone added");
  redirect(`/initiatives/${initiativeId}`);
}

export async function toggleInitiativeMilestone(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeMilestone.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  const completedAt = existing.completedAt ? null : new Date();
  await prisma.initiativeMilestone.update({ where: { id }, data: { completedAt } });
  await audit(session.user.id, "UPDATE", "InitiativeMilestone", id, {
    before: { completedAt: existing.completedAt },
    after: { completedAt },
  });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function removeInitiativeMilestone(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeMilestone.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  await prisma.initiativeMilestone.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeMilestone", id, { before: { title: existing.title } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  await flash("Milestone removed");
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function addInitiativeActionItem(formData: FormData) {
  const session = await requireAdmin();
  const initiativeId = String(formData.get("initiativeId"));
  const title = str(formData, "title");
  const owner = str(formData, "owner");
  if (!title || !owner) redirect(`/initiatives/${initiativeId}`);
  const kind = pick(formData, "kind", ACTION_KINDS, "ACTION");
  const count = await prisma.initiativeActionItem.count({ where: { initiativeId } });
  const created = await prisma.initiativeActionItem.create({
    data: { initiativeId, kind, title, owner, dueAt: date(formData, "dueAt"), order: count },
  });
  await audit(session.user.id, "CREATE", "InitiativeActionItem", created.id, { after: { initiativeId, kind, title, owner } });
  revalidatePath(`/initiatives/${initiativeId}`);
  await flash("Action item added");
  redirect(`/initiatives/${initiativeId}`);
}

export async function toggleInitiativeActionItem(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeActionItem.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  const status = existing.status === "DONE" ? "OPEN" : "DONE";
  await prisma.initiativeActionItem.update({ where: { id }, data: { status } });
  await audit(session.user.id, "UPDATE", "InitiativeActionItem", id, { before: { status: existing.status }, after: { status } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function removeInitiativeActionItem(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeActionItem.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  await prisma.initiativeActionItem.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeActionItem", id, { before: { title: existing.title } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  await flash("Action item removed");
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function addInitiativeEltRequest(formData: FormData) {
  const session = await requireAdmin();
  const initiativeId = String(formData.get("initiativeId"));
  const request = str(formData, "request");
  if (!request) redirect(`/initiatives/${initiativeId}`);
  const kind = pick(formData, "kind", ELT_KINDS, "SUPPORT");
  const count = await prisma.initiativeEltRequest.count({ where: { initiativeId } });
  const created = await prisma.initiativeEltRequest.create({
    data: { initiativeId, request, kind, amount: kind === "INVESTMENT" ? money(formData, "amount") : null, order: count },
  });
  await audit(session.user.id, "CREATE", "InitiativeEltRequest", created.id, { after: { initiativeId, kind, request } });
  revalidatePath(`/initiatives/${initiativeId}`);
  await flash("ELT request added");
  redirect(`/initiatives/${initiativeId}`);
}

export async function updateInitiativeEltRequest(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeEltRequest.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  const status = pick(formData, "status", ELT_STATUSES, existing.status);
  await prisma.initiativeEltRequest.update({ where: { id }, data: { status, decidedNote: str(formData, "decidedNote") ?? existing.decidedNote } });
  await audit(session.user.id, "UPDATE", "InitiativeEltRequest", id, { before: { status: existing.status }, after: { status } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  await flash("ELT request updated");
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function removeInitiativeEltRequest(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeEltRequest.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  await prisma.initiativeEltRequest.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeEltRequest", id, { before: { request: existing.request } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  await flash("ELT request removed");
  redirect(`/initiatives/${existing.initiativeId}`);
}
