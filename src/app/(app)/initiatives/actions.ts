"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { audit } from "@/lib/audit";
import { attachmentKey, deleteAttachment, putAttachment } from "@/lib/storage";
import { quadrantFor, valueFromDollars, effortToLift, parseDollars, type Effort } from "@/lib/initiatives";
import type { InitiativeStatus } from "@/generated/prisma/client";

const STATUSES = ["NOT_STARTED", "PLANNING", "IN_PROGRESS", "AT_RISK", "DONE"];
const EFFORTS = ["S", "M", "L"];

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}
function clampInt(fd: FormData, key: string, min: number, max: number, fallback: number): number {
  const n = Number(fd.get(key));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
// Money inputs may carry "$", commas, "M"/"K" — normalize to a plain number.
function money(fd: FormData, key: string): number | null {
  return parseDollars(str(fd, key));
}
function date(fd: FormData, key: string): Date | null {
  const s = str(fd, key);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Only persist a cimItemCode that matches a real CIM risk; otherwise drop it.
// (The form constrains the picker, but the server must not trust the client.)
async function validCimItemCode(code: string | null): Promise<string | null> {
  if (!code) return null;
  const r = await prisma.cimRisk.findUnique({ where: { code }, select: { code: true } });
  return r ? code : null;
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
    problem: str(fd, "problem"),
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

const plain = (o: unknown) => JSON.parse(JSON.stringify(o));

export async function updateInitiative(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const expectedUpdatedAt = String(formData.get("updatedAt"));

  const before = await prisma.initiative.findUnique({ where: { id } });
  if (!before) redirect("/initiatives");

  // Optimistic concurrency: someone else saved since this form was loaded.
  if (before.updatedAt.toISOString() !== expectedUpdatedAt) {
    redirect(`/initiatives/${id}/edit?conflict=1`);
  }

  if (!str(formData, "problem")) redirect(`/initiatives/${id}/edit?error=problem`);

  const data = parseFields(formData);
  data.cimItemCode = await validCimItemCode(data.cimItemCode);
  const after = await prisma.initiative.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "Initiative", entityId: id, before: plain(before), after: plain(after) },
  });

  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/");
  redirect(`/initiatives/${id}`);
}

export async function createInitiative(formData: FormData) {
  const session = await requireEditor();
  const code = (str(formData, "code") ?? "").toUpperCase();
  if (!code) redirect("/initiatives/new?error=code");
  const exists = await prisma.initiative.findUnique({ where: { code } });
  if (exists) redirect("/initiatives/new?error=duplicate");
  if (!str(formData, "problem")) redirect("/initiatives/new?error=problem");

  const fields = parseFields(formData);
  fields.cimItemCode = await validCimItemCode(fields.cimItemCode);
  const created = await prisma.initiative.create({ data: { code, ...fields } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "Initiative", entityId: created.id, after: plain(created) },
  });

  revalidatePath("/initiatives");
  revalidatePath("/");
  redirect(`/initiatives/${created.id}`);
}

// Inline charter progress update. Percent is purely value created ÷ value to
// create (may exceed 100%); there is no manual percent entry.
export async function updateProgress(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("initiativeId"));
  const before = await prisma.initiative.findUnique({ where: { id } });
  if (!before) redirect("/initiatives");

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
  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: "UPDATE", entity: "Initiative", entityId: id,
      before: plain({ pctComplete: before.pctComplete, progressActual: before.progressActual, progressTarget: before.progressTarget }),
      after: plain({ pctComplete: after.pctComplete, progressActual: after.progressActual, progressTarget: after.progressTarget }),
    },
  });
  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/initiatives");
  revalidatePath("/");
  redirect(`/initiatives/${id}`);
}

function isValidUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

export async function addAttachment(formData: FormData) {
  const session = await requireEditor();
  const initiativeId = String(formData.get("initiativeId"));
  const label = str(formData, "label") ?? "Link";
  const url = str(formData, "url") ?? "";
  if (!isValidUrl(url)) redirect(`/initiatives/${initiativeId}?attachError=1`);

  const created = await prisma.attachment.create({
    data: { initiativeId, kind: "LINK", label, url },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "Attachment", entityId: created.id, after: plain(created) },
  });
  revalidatePath(`/initiatives/${initiativeId}`);
  redirect(`/initiatives/${initiativeId}`);
}

// Charter file uploads go to R2 (src/lib/storage.ts) and are served by
// /api/attachments/<id>, which checks the session. The cap keeps uploads within
// the server-action body limit (next.config.ts).
const MAX_FILE_BYTES = 3 * 1024 * 1024;
// Allowlist of safe attachment types. Crucially EXCLUDES text/html and
// image/svg+xml, which would execute as script when opened inline (stored XSS).
const ALLOWED_FILE_MIME = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "text/plain", "text/csv",
  "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export async function addFileAttachment(formData: FormData) {
  const session = await requireEditor();
  const initiativeId = String(formData.get("initiativeId"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/initiatives/${initiativeId}?attachError=file`);
  }
  if (file.size > MAX_FILE_BYTES) {
    redirect(`/initiatives/${initiativeId}?attachError=size`);
  }
  const mime = file.type || "";
  if (!ALLOWED_FILE_MIME.has(mime)) {
    redirect(`/initiatives/${initiativeId}?attachError=type`);
  }
  if (!(await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { id: true } }))) {
    redirect("/initiatives");
  }

  // Object first, then the row: a failed upload leaves nothing behind, and a
  // failed insert removes the object it just wrote.
  const id = crypto.randomUUID();
  const storageKey = attachmentKey(initiativeId, id);
  await putAttachment(storageKey, file);
  let created;
  try {
    created = await prisma.attachment.create({
      data: {
        id,
        initiativeId,
        kind: "FILE",
        label: file.name || "file",
        url: `/api/attachments/${id}`,
        storageKey,
        contentType: mime,
        size: file.size,
      },
    });
  } catch (e) {
    await deleteAttachment(storageKey);
    throw e;
  }
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "Attachment", entityId: created.id, after: plain(created) },
  });
  revalidatePath(`/initiatives/${initiativeId}`);
  redirect(`/initiatives/${initiativeId}`);
}

export async function removeAttachment(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.attachment.findUnique({ where: { id } });
  if (!before) redirect("/initiatives");

  await prisma.attachment.delete({ where: { id } });
  if (before.storageKey) await deleteAttachment(before.storageKey);
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", entity: "Attachment", entityId: id, before: plain(before) },
  });
  revalidatePath(`/initiatives/${before.initiativeId}`);
  redirect(`/initiatives/${before.initiativeId}`);
}

// ───────────────────────── Sub-initiatives ─────────────────────────
// Lightweight sub-tasks. When sub-tasks exist they are authoritative for the
// parent's % complete (average of their progress). When the last one is
// removed, fall back to the dollar-derived progress (realized/targeted) rather
// than leaving a stale rolled-up value. The parent change is audit-logged so a
// rolled-up overwrite of a previously-set % is never silent.
async function rollUpParent(initiativeId: string, userId: string) {
  const parent = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { pctComplete: true, progressActual: true, progressTarget: true },
  });
  if (!parent) return;
  const subs = await prisma.subInitiative.findMany({ where: { initiativeId } });

  let pct: number;
  if (subs.length > 0) {
    pct = subs.reduce((a, s) => a + (s.status === "DONE" ? 1 : s.pctComplete), 0) / subs.length;
  } else if (parent.progressTarget && parent.progressTarget > 0 && parent.progressActual != null) {
    pct = parent.progressActual / parent.progressTarget;
  } else {
    return; // no sub-tasks and no dollar basis: leave the parent's % as set
  }
  pct = Math.min(1, Math.max(0, pct));
  if (Math.abs(pct - parent.pctComplete) < 1e-9) return; // unchanged

  await prisma.initiative.update({ where: { id: initiativeId }, data: { pctComplete: pct } });
  await prisma.auditLog.create({
    data: { userId, action: "UPDATE", entity: "Initiative", entityId: initiativeId, before: plain({ pctComplete: parent.pctComplete }), after: plain({ pctComplete: pct }) },
  });
}

export async function addSubInitiative(formData: FormData) {
  const session = await requireEditor();
  const initiativeId = String(formData.get("initiativeId"));
  const title = str(formData, "title");
  if (!title) redirect(`/initiatives/${initiativeId}?subError=1`);
  const count = await prisma.subInitiative.count({ where: { initiativeId } });
  const created = await prisma.subInitiative.create({
    data: { initiativeId, title, owner: str(formData, "owner"), order: count },
  });
  await audit(session.user.id, "CREATE", "SubInitiative", created.id, { after: { initiativeId, title } });
  await rollUpParent(initiativeId, session.user.id);
  revalidatePath(`/initiatives/${initiativeId}`);
  redirect(`/initiatives/${initiativeId}`);
}

export async function updateSubInitiative(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.subInitiative.findUnique({ where: { id } });
  if (!before) redirect("/initiatives");
  const statusRaw = String(formData.get("status") ?? "");
  const status = (STATUSES.includes(statusRaw) ? statusRaw : before.status) as InitiativeStatus;
  const pct = clampInt(formData, "pctComplete", 0, 100, Math.round(before.pctComplete * 100)) / 100;
  const updated = await prisma.subInitiative.update({
    where: { id },
    data: { status, pctComplete: status === "DONE" ? 1 : pct },
  });
  await audit(session.user.id, "UPDATE", "SubInitiative", id, { after: { status: updated.status, pctComplete: updated.pctComplete } });
  await rollUpParent(before.initiativeId, session.user.id);
  revalidatePath(`/initiatives/${before.initiativeId}`);
  redirect(`/initiatives/${before.initiativeId}`);
}

export async function removeSubInitiative(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.subInitiative.findUnique({ where: { id } });
  if (!before) redirect("/initiatives");
  await prisma.subInitiative.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "SubInitiative", id, { before: { title: before.title } });
  await rollUpParent(before.initiativeId, session.user.id);
  revalidatePath(`/initiatives/${before.initiativeId}`);
  redirect(`/initiatives/${before.initiativeId}`);
}

// ───────────────────────── Comments ─────────────────────────

export async function addComment(formData: FormData) {
  const session = await requireEditor();
  const initiativeId = String(formData.get("initiativeId"));
  const body = str(formData, "body");
  if (!body) redirect(`/initiatives/${initiativeId}`);
  const created = await prisma.initiativeComment.create({
    data: {
      initiativeId,
      authorUserId: session.user.id,
      authorName: session.user.name || session.user.email || "Unknown",
      body: body.slice(0, 5000),
    },
  });
  await audit(session.user.id, "CREATE", "InitiativeComment", created.id, { after: { initiativeId, authorName: created.authorName } });
  revalidatePath(`/initiatives/${initiativeId}`);
  redirect(`/initiatives/${initiativeId}`);
}

export async function removeComment(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.initiativeComment.findUnique({ where: { id } });
  if (!before) redirect("/initiatives");
  // Authors can remove their own; admins can remove any.
  if (before.authorUserId !== session.user.id && session.user.role !== "admin") {
    redirect(`/initiatives/${before.initiativeId}`);
  }
  await prisma.initiativeComment.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeComment", id, { before: { authorName: before.authorName, body: before.body.slice(0, 120) } });
  revalidatePath(`/initiatives/${before.initiativeId}`);
  redirect(`/initiatives/${before.initiativeId}`);
}

export async function deleteInitiative(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.initiative.findUnique({ where: { id } });
  if (!before) redirect("/initiatives");
  // Attachment rows cascade with the initiative; their R2 objects don't.
  const files = await prisma.attachment.findMany({
    where: { initiativeId: id, storageKey: { not: null } },
    select: { storageKey: true },
  });

  await prisma.initiative.delete({ where: { id } });
  await Promise.all(files.map((f) => deleteAttachment(f.storageKey!)));
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", entity: "Initiative", entityId: id, before: plain(before) },
  });

  revalidatePath("/initiatives");
  revalidatePath("/");
  redirect("/initiatives");
}

// ---------------------------------------------------------------------------
// Alex's SI punch list (8/31): risk log, dated milestones, dependencies and
// actions with owners, ELT support/investment requests. All per-initiative.

const RISK_STATUSES = ["OPEN", "MITIGATED", "ACCEPTED"];
const ACTION_KINDS = ["DEPENDENCY", "ACTION"];
const ELT_KINDS = ["SUPPORT", "INVESTMENT"];
const ELT_STATUSES = ["REQUESTED", "APPROVED", "DECLINED"];

function pick(fd: FormData, key: string, allowed: string[], fallback: string): string {
  const v = String(fd.get(key) ?? "");
  return allowed.includes(v) ? v : fallback;
}

export async function addInitiativeRisk(formData: FormData) {
  const session = await requireEditor();
  const initiativeId = String(formData.get("initiativeId"));
  const risk = str(formData, "risk");
  if (!risk) redirect(`/initiatives/${initiativeId}`);
  const count = await prisma.initiativeRisk.count({ where: { initiativeId } });
  const created = await prisma.initiativeRisk.create({
    data: { initiativeId, risk, mitigation: str(formData, "mitigation"), owner: str(formData, "owner"), order: count },
  });
  await audit(session.user.id, "CREATE", "InitiativeRisk", created.id, { after: { initiativeId, risk } });
  revalidatePath(`/initiatives/${initiativeId}`);
  redirect(`/initiatives/${initiativeId}`);
}

export async function updateInitiativeRisk(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeRisk.findUnique({ where: { id } });
  if (!existing) redirect("/initiatives");
  const status = pick(formData, "status", RISK_STATUSES, existing.status);
  const mitigation = formData.has("mitigation") ? str(formData, "mitigation") : existing.mitigation;
  await prisma.initiativeRisk.update({ where: { id }, data: { status, mitigation } });
  await audit(session.user.id, "UPDATE", "InitiativeRisk", id, { before: { status: existing.status }, after: { status } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function removeInitiativeRisk(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeRisk.findUnique({ where: { id } });
  if (!existing) redirect("/initiatives");
  await prisma.initiativeRisk.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeRisk", id, { before: { risk: existing.risk } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  redirect(`/initiatives/${existing.initiativeId}`);
}

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
  redirect(`/initiatives/${initiativeId}`);
}

export async function toggleInitiativeMilestone(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeMilestone.findUnique({ where: { id } });
  if (!existing) redirect("/initiatives");
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
  if (!existing) redirect("/initiatives");
  await prisma.initiativeMilestone.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeMilestone", id, { before: { title: existing.title } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  redirect(`/initiatives/${existing.initiativeId}`);
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
  redirect(`/initiatives/${initiativeId}`);
}

export async function toggleInitiativeActionItem(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeActionItem.findUnique({ where: { id } });
  if (!existing) redirect("/initiatives");
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
  if (!existing) redirect("/initiatives");
  await prisma.initiativeActionItem.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeActionItem", id, { before: { title: existing.title } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
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
  redirect(`/initiatives/${initiativeId}`);
}

export async function updateInitiativeEltRequest(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeEltRequest.findUnique({ where: { id } });
  if (!existing) redirect("/initiatives");
  const status = pick(formData, "status", ELT_STATUSES, existing.status);
  await prisma.initiativeEltRequest.update({ where: { id }, data: { status, decidedNote: str(formData, "decidedNote") ?? existing.decidedNote } });
  await audit(session.user.id, "UPDATE", "InitiativeEltRequest", id, { before: { status: existing.status }, after: { status } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  redirect(`/initiatives/${existing.initiativeId}`);
}

export async function removeInitiativeEltRequest(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const existing = await prisma.initiativeEltRequest.findUnique({ where: { id } });
  if (!existing) redirect("/initiatives");
  await prisma.initiativeEltRequest.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeEltRequest", id, { before: { request: existing.request } });
  revalidatePath(`/initiatives/${existing.initiativeId}`);
  redirect(`/initiatives/${existing.initiativeId}`);
}
