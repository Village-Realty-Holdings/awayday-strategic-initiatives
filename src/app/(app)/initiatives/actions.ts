"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appNow } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { str, date, pick } from "@/lib/form";
import { flash } from "@/lib/flash";
import { canEdit, requireAdmin, requireEditor, requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { getActivePlan } from "@/lib/active-plan";
import { deleteAttachment } from "@/lib/storage";
import { quadrantFor, valueFromDollars, effortToLift, parseDollars } from "@/lib/initiatives";
import { initiativeOwnerMatches } from "@/lib/review-model";
import { diffRows, parseDependencyRows, parseMilestoneRows, parseRiskRows, splitByWhen } from "@/lib/charter-rows";
import { derivedPct, MEASURE_KINDS, MEASURE_UNITS, parseMeasureValue } from "@/lib/measures";


// Money inputs may carry "$", commas, "M"/"K" — normalize to a plain number.
function money(fd: FormData, key: string): number | null {
  return parseDollars(str(fd, key));
}

// The Area picker is optional, but the server must not trust the client: the
// chosen area has to belong to the plan the initiative sits in. Returns the id
// if valid, else null (callers treat a non-empty-but-invalid choice as an error).
async function validAreaId(areaId: string | null, planId: string | null): Promise<string | null> {
  if (!areaId || !planId) return null;
  const a = await prisma.strategicArea.findFirst({ where: { id: areaId, planVersionId: planId }, select: { id: true } });
  return a ? a.id : null;
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

export async function updateInitiative(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const expectedUpdatedAt = String(formData.get("updatedAt"));

  const before = await prisma.initiative.findUnique({ where: { id } });
  if (!before) redirect("/admin/initiatives");

  // Optimistic concurrency: someone else saved since this form was loaded.
  if (before.updatedAt.toISOString() !== expectedUpdatedAt) {
    redirect(`/admin/initiatives/${id}/edit?conflict=1`);
  }

  const data = parseFields(formData);
  const after = await prisma.initiative.update({ where: { id }, data });
  await saveCharterRows(id, formData);
  await audit(session.user.id, "UPDATE", "Initiative", id, { before, after });

  revalidatePath("/admin/initiatives");
  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/");
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
  // New initiatives join the active plan so they show up on the plan-scoped
  // views; the optional area must belong to that plan.
  const activePlan = await getActivePlan();
  const chosenArea = str(formData, "strategicAreaId");
  const strategicAreaId = await validAreaId(chosenArea, activePlan?.id ?? null);
  if (chosenArea && !strategicAreaId) redirect("/admin/initiatives/new?error=area");
  // Scored neutrally until someone values it; it starts with no status.
  const value = valueFromDollars(null);
  const lift = effortToLift("M");
  const created = await prisma.initiative.create({
    data: { code, ...fields, cimDriver: str(formData, "cimDriver"), value, lift, quadrant: quadrantFor(value, lift), planVersionId: activePlan?.id ?? null, strategicAreaId },
  });
  await saveCharterRows(created.id, formData);
  await audit(session.user.id, "CREATE", "Initiative", created.id, { after: created });

  revalidatePath("/admin/initiatives");
  revalidatePath("/");
  await flash("Initiative created");
  redirect(`/initiatives/${created.id}`);
}

// Inline charter progress update. Percent is value created ÷ value to create (may
// exceed 100%), or the first KPI's progress without both; there is no manual percent entry.
export async function updateProgress(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("initiativeId"));
  const before = await prisma.initiative.findUnique({ where: { id } });
  if (!before) redirect("/admin/initiatives");

  // Dollar inputs may carry commas / $ / M-K suffixes.
  const actual = parseDollars(str(formData, "actual"));
  const target = parseDollars(str(formData, "target"));
  // Derive percent from the dollar values or first KPI; keep prior when neither gives one.
  const measures = await prisma.initiativeMeasure.findMany({ where: { initiativeId: id }, include: { readings: true } });
  const pct = derivedPct(actual, target, measures) ?? before.pctComplete;

  const after = await prisma.initiative.update({
    where: { id },
    data: { progressActual: actual, progressTarget: target, pctComplete: pct },
  });
  await audit(session.user.id, "UPDATE", "Initiative", id, { before: { pctComplete: before.pctComplete, progressActual: before.progressActual, progressTarget: before.progressTarget }, after: { pctComplete: after.pctComplete, progressActual: after.progressActual, progressTarget: after.progressTarget } });
  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/admin/initiatives");
  revalidatePath("/");
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
  await flash("Initiative deleted");
  redirect("/admin/initiatives");
}

// ---------------------------------------------------------------------------
// Alex's SI punch list (8/31): risk log, dated milestones, dependencies and
// actions with owners, ELT support/investment requests. All per-initiative.

const ACTION_KINDS = ["DEPENDENCY", "ACTION"];
const ELT_KINDS = ["SUPPORT", "INVESTMENT"];
const ELT_STATUSES = ["REQUESTED", "APPROVED", "DECLINED"];


export async function addInitiativeMilestone(formData: FormData) {
  const session = await requireEditor();
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
  const session = await requireEditor();
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
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeMilestone.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  await prisma.initiativeMilestone.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeMilestone", id, { before: { title: existing.title } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  await flash("Milestone removed");
  redirect(`/initiatives/${existing.initiativeId}`);
}

// A value initiative's percent follows its measures unless dollars drive it.
// Non-value initiatives stay status-driven. Returns the percent now stored.
async function syncMeasurePct(initiativeId: string): Promise<number | null> {
  const i = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { valueType: true, pctComplete: true, progressActual: true, progressTarget: true, measures: { include: { readings: true } } },
  });
  if (!i || i.valueType !== "VALUE") return null;
  const pct = derivedPct(i.progressActual, i.progressTarget, i.measures) ?? 0;
  if (pct !== i.pctComplete) await prisma.initiative.update({ where: { id: initiativeId }, data: { pctComplete: pct } });
  return pct;
}

function revalidateMeasurePaths(initiativeId: string) {
  revalidatePath(`/initiatives/${initiativeId}`);
  revalidatePath("/admin/initiatives");
  revalidatePath("/inbox");
  revalidatePath("/");
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

// Name, kind, unit, baseline and target, shared by add + edit. A blank baseline or
// target is allowed (progress just can't be worked out yet); an unreadable one isn't.
async function parseMeasureFields(fd: FormData, initiativeId: string) {
  const name = str(fd, "name");
  const baselineRaw = str(fd, "baseline");
  const targetRaw = str(fd, "target");
  const baseline = parseMeasureValue(baselineRaw);
  const target = parseMeasureValue(targetRaw);
  if (!name || (baselineRaw && baseline === null) || (targetRaw && target === null)) {
    await flash(name ? "Baseline and target must be numbers, e.g. 18, 12.5% or $1.5M" : "A measure needs a name", "error");
    redirect(`/initiatives/${initiativeId}`);
  }
  return {
    name,
    kind: pick(fd, "kind", MEASURE_KINDS, "KPI"),
    unit: pick(fd, "unit", MEASURE_UNITS, "NUMBER"),
    baseline,
    target,
  };
}

export async function addInitiativeMeasure(formData: FormData) {
  const initiativeId = String(formData.get("initiativeId"));
  const session = await requireMeasureEditor(initiativeId);
  const fields = await parseMeasureFields(formData, initiativeId);
  const { _max } = await prisma.initiativeMeasure.aggregate({ where: { initiativeId }, _max: { order: true } });
  const created = await prisma.initiativeMeasure.create({ data: { initiativeId, ...fields, order: (_max.order ?? -1) + 1 } });
  const pctComplete = await syncMeasurePct(initiativeId);
  await audit(session.user.id, "CREATE", "InitiativeMeasure", created.id, { after: { initiativeId, ...fields, pctComplete } });
  revalidateMeasurePaths(initiativeId);
  await flash("Measure added");
  redirect(`/initiatives/${initiativeId}`);
}

export async function updateInitiativeMeasure(formData: FormData) {
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeMeasure.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  const session = await requireMeasureEditor(existing.initiativeId);
  const fields = await parseMeasureFields(formData, existing.initiativeId);
  await prisma.initiativeMeasure.update({ where: { id }, data: fields });
  const pctComplete = await syncMeasurePct(existing.initiativeId);
  await audit(session.user.id, "UPDATE", "InitiativeMeasure", id, { before: existing, after: { ...fields, pctComplete } });
  revalidateMeasurePaths(existing.initiativeId);
  await flash("Measure saved");
  redirect(`/initiatives/${existing.initiativeId}`);
}

// Moves a KPI ahead of the others, which makes it the one percent complete follows.
export async function setPrimaryInitiativeMeasure(formData: FormData) {
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeMeasure.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  const session = await requireMeasureEditor(existing.initiativeId);
  const { _min } = await prisma.initiativeMeasure.aggregate({ where: { initiativeId: existing.initiativeId }, _min: { order: true } });
  const order = (_min.order ?? 0) - 1;
  await prisma.initiativeMeasure.update({ where: { id }, data: { order } });
  const pctComplete = await syncMeasurePct(existing.initiativeId);
  await audit(session.user.id, "UPDATE", "InitiativeMeasure", id, { before: { order: existing.order }, after: { order, pctComplete } });
  revalidateMeasurePaths(existing.initiativeId);
  await flash("Percent complete now follows this KPI");
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function removeInitiativeMeasure(formData: FormData) {
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeMeasure.findUnique({ where: { id }, include: { readings: true } });
  if (!existing) redirect("/admin/initiatives");
  const session = await requireMeasureEditor(existing.initiativeId);
  await prisma.initiativeMeasure.delete({ where: { id } });
  const pctComplete = await syncMeasurePct(existing.initiativeId);
  await audit(session.user.id, "DELETE", "InitiativeMeasure", id, { before: existing, after: { pctComplete } });
  revalidateMeasurePaths(existing.initiativeId);
  await flash("Measure removed");
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function addInitiativeMeasureReading(formData: FormData) {
  const measureId = String(formData.get("measureId"));
  const measure = await prisma.initiativeMeasure.findUnique({ where: { id: measureId }, select: { initiativeId: true } });
  if (!measure) redirect("/admin/initiatives");
  const session = await requireMeasureEditor(measure.initiativeId);
  // Inbox enters values from a dialog, which stays open; the SI page reloads itself.
  const leave = () => (str(formData, "returnTo") === "inbox" ? undefined : redirect(`/initiatives/${measure.initiativeId}`));
  const value = parseMeasureValue(str(formData, "value"));
  if (value === null) {
    await flash("Enter the latest value as a number, e.g. 18, 12.5% or $1.5M", "error");
    return leave();
  }
  const now = appNow();
  const asOf = date(formData, "asOf") ?? now;
  // A day's grace: the picker's "today" can be ahead of the server's in some time zones.
  if (asOf.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    await flash("The as-of date can't be in the future", "error");
    return leave();
  }
  const note = str(formData, "note");
  const created = await prisma.initiativeMeasureReading.create({
    data: { measureId, value, asOf, note, enteredBy: session.user.name },
  });
  const pctComplete = await syncMeasurePct(measure.initiativeId);
  await audit(session.user.id, "CREATE", "InitiativeMeasureReading", created.id, { after: { measureId, value, asOf, note, pctComplete } });
  revalidateMeasurePaths(measure.initiativeId);
  await flash("Measure updated");
  return leave();
}

export async function removeInitiativeMeasureReading(formData: FormData) {
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeMeasureReading.findUnique({ where: { id }, include: { measure: { select: { initiativeId: true } } } });
  if (!existing) redirect("/admin/initiatives");
  const session = await requireMeasureEditor(existing.measure.initiativeId);
  const { measure, ...before } = existing;
  await prisma.initiativeMeasureReading.delete({ where: { id } });
  const pctComplete = await syncMeasurePct(measure.initiativeId);
  await audit(session.user.id, "DELETE", "InitiativeMeasureReading", id, { before, after: { pctComplete } });
  revalidateMeasurePaths(measure.initiativeId);
  await flash("Update removed");
  redirect(`/initiatives/${measure.initiativeId}`);
}

export async function addInitiativeActionItem(formData: FormData) {
  const session = await requireEditor();
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
  const session = await requireEditor();
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
  const session = await requireEditor();
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
  const session = await requireEditor();
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
  const session = await requireEditor();
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
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeEltRequest.findUnique({ where: { id } });
  if (!existing) redirect("/admin/initiatives");
  await prisma.initiativeEltRequest.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeEltRequest", id, { before: { request: existing.request } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  await flash("ELT request removed");
  redirect(`/initiatives/${existing.initiativeId}`);
}
