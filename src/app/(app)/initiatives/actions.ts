"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { str, date } from "@/lib/form";
import { flash } from "@/lib/flash";
import { canEdit, requireAdmin, requireEditor, requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { deleteAttachment } from "@/lib/storage";
import { parseDollars } from "@/lib/initiatives";
import { initiativeOwnerMatches } from "@/lib/review-model";
import { diffRows, parseDependencyRows, parseMilestoneRows, parseRiskRows, splitByWhen } from "@/lib/charter-rows";
import * as edits from "@/lib/initiative-edits";


// Money inputs may carry "$", commas, "M"/"K" — normalize to a plain number.
function money(fd: FormData, key: string): number | null {
  return parseDollars(str(fd, key));
}

// The charter fields on the form, shared by create + update. Everything else
// (dates, team, deliverables, dollars, scoring, status) isn't on the form, so it
// is intentionally NOT written here and keeps its saved value.
function parseFields(fd: FormData) {
  return {
    name: str(fd, "name") ?? "Untitled initiative",
    teamLead: str(fd, "teamLead"),
    secondaryLead: str(fd, "secondaryLead"),
    valueWhenComplete: str(fd, "valueWhenComplete"),
    quantMetric: str(fd, "quantMetric"),
    quantTarget: str(fd, "quantTarget"),
    baseline: str(fd, "baseline"),
    ebitdaValue: str(fd, "ebitdaValue"),
    investmentCost: str(fd, "investmentCost"),
  };
}

// The charter's risk, dependency and milestone tables, posted as JSON rows.
// Posted rows update their stored row by id, new rows are created and stored
// rows missing from the post are deleted. A table the form didn't post is left
// alone. Milestone completion and dependency status are kept on update.
// Dependencies are the DEPENDENCY action items; plain actions aren't touched.
async function saveCharterRows(initiativeId: string, fd: FormData) {
  const [risks, deps, milestones] = await Promise.all([
    prisma.initiativeRisk.findMany({ where: { initiativeId }, select: { id: true } }),
    prisma.initiativeActionItem.findMany({ where: { initiativeId, kind: "DEPENDENCY" }, select: { id: true } }),
    prisma.initiativeMilestone.findMany({ where: { initiativeId }, select: { id: true } }),
  ]);
  const ops = [];

  if (fd.has("risksJson")) {
    const posted = parseRiskRows(str(fd, "risksJson"));
    const { create, update, remove } = diffRows(posted, risks.map((r) => r.id));
    const data = (r: (typeof posted)[number]) => ({ risk: r.risk, mitigation: r.mitigation || null, owner: r.owner || null, order: posted.indexOf(r) });
    ops.push(prisma.initiativeRisk.deleteMany({ where: { initiativeId, id: { in: remove } } }));
    ops.push(...update.map((r) => prisma.initiativeRisk.update({ where: { id: r.id }, data: data(r) })));
    if (create.length) ops.push(prisma.initiativeRisk.createMany({ data: create.map((r) => ({ initiativeId, ...data(r) })) }));
  }

  if (fd.has("dependenciesJson")) {
    const posted = parseDependencyRows(str(fd, "dependenciesJson"));
    const { create, update, remove } = diffRows(posted, deps.map((r) => r.id));
    const data = (r: (typeof posted)[number]) => ({ title: r.need, owner: r.fromWhom, ...splitByWhen(r.byWhen), order: posted.indexOf(r) });
    ops.push(prisma.initiativeActionItem.deleteMany({ where: { initiativeId, kind: "DEPENDENCY", id: { in: remove } } }));
    ops.push(...update.map((r) => prisma.initiativeActionItem.update({ where: { id: r.id }, data: data(r) })));
    if (create.length) ops.push(prisma.initiativeActionItem.createMany({ data: create.map((r) => ({ initiativeId, kind: "DEPENDENCY", ...data(r) })) }));
  }

  if (fd.has("milestonesJson")) {
    const posted = parseMilestoneRows(str(fd, "milestonesJson"));
    const { create, update, remove } = diffRows(posted, milestones.map((r) => r.id));
    const data = (r: (typeof posted)[number]) => ({
      title: r.title,
      owner: r.owner || null,
      dueAt: r.dueAt ? new Date(`${r.dueAt}T00:00:00.000Z`) : null,
      order: posted.indexOf(r),
    });
    ops.push(prisma.initiativeMilestone.deleteMany({ where: { initiativeId, id: { in: remove } } }));
    ops.push(...update.map((r) => prisma.initiativeMilestone.update({ where: { id: r.id }, data: data(r) })));
    if (create.length) ops.push(prisma.initiativeMilestone.createMany({ data: create.map((r) => ({ initiativeId, ...data(r) })) }));
  }

  if (ops.length) await prisma.$transaction(ops);
}

// Form actions for the initiative pages. The edits themselves (permissions,
// validation, audit) live in lib/initiative-edits.ts, shared with the MCP
// endpoint; these read the form, then flash and redirect.

type Result = edits.InitiativeEditResult;

async function back(initiativeId: string, result: Result, success?: string): Promise<never> {
  if (result.ok) {
    if (success) await flash(success);
  } else {
    await flash(result.error, "error");
  }
  redirect(`/initiatives/${initiativeId}`);
}

export async function updateInitiative(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const result = await edits.updateInitiativeCharter(session.user, id, parseFields(formData), String(formData.get("updatedAt")));
  if (!result.ok) {
    // Optimistic concurrency: someone else saved since this form was loaded.
    if (result.reason === "conflict") redirect(`/admin/initiatives/${id}/edit?conflict=1`);
    redirect("/admin/initiatives");
  }
  await saveCharterRows(id, formData);
  revalidatePath("/admin/initiatives");
  revalidatePath(`/initiatives/${id}`);
  await flash("Initiative saved");
  redirect(`/initiatives/${id}`);
}

export async function createInitiative(formData: FormData) {
  const session = await requireAdmin();
  const result = await edits.createInitiative(session.user, {
    code: str(formData, "code") ?? "",
    cimDriver: str(formData, "cimDriver"),
    strategicAreaId: str(formData, "strategicAreaId"),
    ...parseFields(formData),
  });
  if (!result.ok) redirect(`/admin/initiatives/new?error=${result.reason ?? "code"}`);
  await saveCharterRows(result.id!, formData);
  revalidatePath("/admin/initiatives");
  await flash("Initiative created");
  redirect(`/initiatives/${result.id}`);
}

// Inline charter progress update. Percent is value created ÷ value to create (may
// exceed 100%), or the first KPI's progress without both; there is no manual percent entry.
export async function updateProgress(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("initiativeId"));
  // Dollar inputs may carry commas / $ / M-K suffixes.
  const result = await edits.updateInitiativeProgress(session.user, id, { actual: money(formData, "actual"), target: money(formData, "target") });
  if (!result.ok) redirect("/admin/initiatives");
  await back(id, result, "Progress updated");
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
  await flash("Initiative deleted");
  redirect("/admin/initiatives");
}

// ---------------------------------------------------------------------------
// Alex's SI punch list (8/31): risk log, dated milestones, dependencies and
// actions with owners, ELT support/investment requests. All per-initiative.

/** The initiative a milestone, action item or ask belongs to, for the redirect back. */
async function initiativeOf(model: "initiativeMilestone" | "initiativeActionItem" | "initiativeEltRequest", id: string): Promise<string> {
  const row = await (prisma[model] as unknown as { findUnique(a: unknown): Promise<{ initiativeId: string } | null> }).findUnique({ where: { id }, select: { initiativeId: true } });
  if (!row) redirect("/admin/initiatives");
  return row.initiativeId;
}

export async function addInitiativeMilestone(formData: FormData) {
  const session = await requireEditor();
  const initiativeId = String(formData.get("initiativeId"));
  const result = await edits.addMilestone(session.user, initiativeId, { title: str(formData, "title") ?? "", owner: str(formData, "owner"), dueAt: date(formData, "dueAt") });
  await back(initiativeId, result, "Milestone added");
}

export async function toggleInitiativeMilestone(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const initiativeId = await initiativeOf("initiativeMilestone", id);
  await back(initiativeId, await edits.setMilestoneDone(session.user, id, "toggle"));
}

export async function removeInitiativeMilestone(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const initiativeId = await initiativeOf("initiativeMilestone", id);
  await back(initiativeId, await edits.removeMilestone(session.user, id), "Milestone removed");
}

// Measures are the one part of a charter an SI's own lead keeps up to date, so
// they pass here as well as editors.
async function requireMeasureEditor(initiativeId: string) {
  const session = await requireSession();
  const initiative = await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { ownerUserId: true, teamLead: true } });
  if (!initiative) redirect("/admin/initiatives");
  if (!canEdit(session.user.role) && !initiativeOwnerMatches(initiative, session.user)) redirect("/");
  return session;
}

function measureInput(fd: FormData): edits.MeasureInput {
  return { name: str(fd, "name") ?? "", kind: str(fd, "kind"), unit: str(fd, "unit"), baseline: str(fd, "baseline"), target: str(fd, "target") };
}

async function measureOf(id: string): Promise<string> {
  const row = await prisma.initiativeMeasure.findUnique({ where: { id }, select: { initiativeId: true } });
  if (!row) redirect("/admin/initiatives");
  return row.initiativeId;
}

export async function addInitiativeMeasure(formData: FormData) {
  const initiativeId = String(formData.get("initiativeId"));
  const session = await requireMeasureEditor(initiativeId);
  await back(initiativeId, await edits.addMeasure(session.user, initiativeId, measureInput(formData)), "Measure added");
}

export async function updateInitiativeMeasure(formData: FormData) {
  const id = String(formData.get("id"));
  const initiativeId = await measureOf(id);
  const session = await requireMeasureEditor(initiativeId);
  await back(initiativeId, await edits.updateMeasure(session.user, id, measureInput(formData)), "Measure saved");
}

// Moves a KPI ahead of the others, which makes it the one percent complete follows.
export async function setPrimaryInitiativeMeasure(formData: FormData) {
  const id = String(formData.get("id"));
  const initiativeId = await measureOf(id);
  const session = await requireMeasureEditor(initiativeId);
  await back(initiativeId, await edits.setPrimaryMeasure(session.user, id), "Percent complete now follows this KPI");
}

export async function removeInitiativeMeasure(formData: FormData) {
  const id = String(formData.get("id"));
  const initiativeId = await measureOf(id);
  const session = await requireMeasureEditor(initiativeId);
  await back(initiativeId, await edits.removeMeasure(session.user, id), "Measure removed");
}

export async function addInitiativeMeasureReading(formData: FormData) {
  const measureId = String(formData.get("measureId"));
  const initiativeId = await measureOf(measureId);
  const session = await requireMeasureEditor(initiativeId);
  const result = await edits.addMeasureReading(session.user, measureId, { value: str(formData, "value") ?? "", asOf: date(formData, "asOf"), note: str(formData, "note") });
  // Inbox enters values from a dialog, which stays open; the SI page reloads itself.
  if (str(formData, "returnTo") === "inbox") {
    await flash(result.ok ? "Measure updated" : result.error, result.ok ? undefined : "error");
    return;
  }
  await back(initiativeId, result, "Measure updated");
}

export async function removeInitiativeMeasureReading(formData: FormData) {
  const id = String(formData.get("id"));
  const reading = await prisma.initiativeMeasureReading.findUnique({ where: { id }, select: { measure: { select: { initiativeId: true } } } });
  if (!reading) redirect("/admin/initiatives");
  const initiativeId = reading.measure.initiativeId;
  const session = await requireMeasureEditor(initiativeId);
  await back(initiativeId, await edits.removeMeasureReading(session.user, id), "Update removed");
}

export async function addInitiativeActionItem(formData: FormData) {
  const session = await requireEditor();
  const initiativeId = String(formData.get("initiativeId"));
  const result = await edits.addActionItem(session.user, initiativeId, {
    title: str(formData, "title") ?? "",
    owner: str(formData, "owner") ?? "",
    kind: str(formData, "kind"),
    dueAt: date(formData, "dueAt"),
  });
  await back(initiativeId, result, "Action item added");
}

export async function toggleInitiativeActionItem(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const initiativeId = await initiativeOf("initiativeActionItem", id);
  await back(initiativeId, await edits.setActionItemDone(session.user, id, "toggle"));
}

export async function removeInitiativeActionItem(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const initiativeId = await initiativeOf("initiativeActionItem", id);
  await back(initiativeId, await edits.removeActionItem(session.user, id), "Action item removed");
}

export async function addInitiativeEltRequest(formData: FormData) {
  const session = await requireEditor();
  const initiativeId = String(formData.get("initiativeId"));
  const result = await edits.addEltRequest(session.user, initiativeId, { request: str(formData, "request") ?? "", kind: str(formData, "kind"), amount: money(formData, "amount") });
  await back(initiativeId, result, "ELT request added");
}

export async function updateInitiativeEltRequest(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const initiativeId = await initiativeOf("initiativeEltRequest", id);
  // The form only ever sets the note; a blank one keeps what's saved.
  const result = await edits.updateEltRequest(session.user, id, { status: str(formData, "status"), decidedNote: str(formData, "decidedNote") ?? undefined });
  await back(initiativeId, result, "ELT request updated");
}

export async function removeInitiativeEltRequest(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const initiativeId = await initiativeOf("initiativeEltRequest", id);
  await back(initiativeId, await edits.removeEltRequest(session.user, id), "ELT request removed");
}
