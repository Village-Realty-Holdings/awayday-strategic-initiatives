import { revalidatePath } from "next/cache";
import { appNow } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getActivePlan } from "@/lib/active-plan";
import { canEdit } from "@/lib/roles";
import { effortToLift, quadrantFor, valueFromDollars } from "@/lib/initiatives";
import { initiativeOwnerMatches } from "@/lib/review-model";
import { derivedPct, MEASURE_KINDS, MEASURE_UNITS, parseMeasureValue } from "@/lib/measures";
import type { Actor } from "@/lib/review-edits";

// ---------------------------------------------------------------------------
// Initiative edits, shared by the initiative server actions and the MCP
// endpoint. Callers authenticate and pass the actor; permissions, validation,
// the audit log and revalidation all happen here, so the app and MCP agree.
//
// Who can do what (as in the app):
// - Admins: create an initiative.
// - Editors and admins: everything else here.
// - An SI's own lead: its measures and readings, and marking its milestones
//   and action items done.
// - A milestone's or action item's owner: marking it done.
// ---------------------------------------------------------------------------

export type InitiativeEditResult = { ok: true; id?: string } | { ok: false; error: string; reason?: "conflict" | "code" | "duplicate" | "area" };

export const ACTION_KINDS = ["DEPENDENCY", "ACTION"] as const;
export const ELT_KINDS = ["SUPPORT", "INVESTMENT"] as const;
export const ELT_STATUSES = ["REQUESTED", "APPROVED", "DECLINED"] as const;

/** The charter fields the initiative form edits. Everything else keeps its saved value. */
export const CHARTER_FIELDS = ["name", "teamLead", "secondaryLead", "valueWhenComplete", "quantMetric", "quantTarget", "baseline", "ebitdaValue", "investmentCost"] as const;
export type CharterField = (typeof CHARTER_FIELDS)[number];
/** Each field: undefined leaves it as it is, null (or blank) clears it. A name can't be cleared. */
export type CharterInput = Partial<Record<CharterField, string | null>>;

const NOT_EDITOR: InitiativeEditResult = { ok: false, error: "Only admins and editors can change initiatives." };
const NO_INITIATIVE: InitiativeEditResult = { ok: false, error: "That initiative no longer exists." };

function revalidateInitiatives() {
  revalidatePath("/", "layout");
}

const clean = (v: string | null | undefined, max: number) => v?.trim().slice(0, max) || null;

const ownerSelect = { id: true, ownerUserId: true, teamLead: true } as const;
type OwnedInitiative = { id: string; ownerUserId: string | null; teamLead: string | null };

/** True for editors, admins and the SI's own lead. */
function leadsOrEdits(actor: Actor, initiative: OwnedInitiative): boolean {
  return canEdit(actor.role) || initiativeOwnerMatches({ ownerUserId: initiative.ownerUserId ?? null, teamLead: initiative.teamLead ?? null }, actor);
}

/** A day written YYYY-MM-DD at UTC midnight, a Date as it is, or null. */
function dayOf(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// The initiative
// ---------------------------------------------------------------------------

function charterData(fields: CharterInput) {
  const data: Partial<Record<CharterField, string | null>> = {};
  for (const key of CHARTER_FIELDS) {
    if (fields[key] === undefined) continue;
    data[key] = clean(fields[key], key === "name" ? 200 : 5000);
  }
  return data;
}

export const CONFLICT_ERROR = "Someone else saved this initiative since you loaded it. Reload it and try again.";

/** Edit the charter fields. `expectedUpdatedAt` (ISO) refuses the save if someone saved since. */
export async function updateInitiativeCharter(actor: Actor, initiativeId: string, fields: CharterInput, expectedUpdatedAt?: string): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const before = await prisma.initiative.findUnique({ where: { id: initiativeId } });
  if (!before) return NO_INITIATIVE;
  if (expectedUpdatedAt && before.updatedAt.toISOString() !== expectedUpdatedAt) return { ok: false, error: CONFLICT_ERROR, reason: "conflict" };
  const { name, ...rest } = charterData(fields);
  if (name === null) return { ok: false, error: "An initiative needs a name." };
  const after = await prisma.initiative.update({ where: { id: initiativeId }, data: { ...rest, ...(name ? { name } : {}) } });
  await audit(actor.id, "UPDATE", "Initiative", initiativeId, { before, after });
  revalidateInitiatives();
  return { ok: true, id: initiativeId };
}

/**
 * A new initiative in the active plan (admins). It starts scored neutrally,
 * with no status, until someone values it. The area, when given, must belong
 * to the active plan.
 */
export async function createInitiative(
  actor: Actor,
  input: { code: string; cimDriver?: string | null; strategicAreaId?: string | null } & CharterInput,
): Promise<InitiativeEditResult> {
  if (actor.role !== "admin") return { ok: false, error: "Only admins can create initiatives." };
  const code = input.code.trim().toUpperCase().slice(0, 40);
  if (!code) return { ok: false, error: "An initiative needs a code.", reason: "code" };
  if (await prisma.initiative.findUnique({ where: { code } })) return { ok: false, error: `An initiative with code ${code} already exists.`, reason: "duplicate" };
  const plan = await getActivePlan();
  let strategicAreaId: string | null = null;
  if (input.strategicAreaId) {
    const area = plan ? await prisma.strategicArea.findFirst({ where: { id: input.strategicAreaId, planVersionId: plan.id }, select: { id: true } }) : null;
    if (!area) return { ok: false, error: "That pillar is not in the active plan.", reason: "area" };
    strategicAreaId = area.id;
  }
  const fields = charterData(input);
  const value = valueFromDollars(null);
  const lift = effortToLift("M");
  const created = await prisma.initiative.create({
    data: {
      code,
      ...fields,
      name: fields.name ?? "Untitled initiative",
      cimDriver: clean(input.cimDriver, 200),
      value,
      lift,
      quadrant: quadrantFor(value, lift),
      planVersionId: plan?.id ?? null,
      strategicAreaId,
    },
  });
  await audit(actor.id, "CREATE", "Initiative", created.id, { after: created });
  revalidateInitiatives();
  return { ok: true, id: created.id };
}

/**
 * Value created and value to create, in dollars. Percent complete is worked
 * out from them, or from the first KPI without both; there is no manual percent.
 */
export async function updateInitiativeProgress(actor: Actor, initiativeId: string, input: { actual: number | null; target: number | null }): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const before = await prisma.initiative.findUnique({ where: { id: initiativeId } });
  if (!before) return NO_INITIATIVE;
  const measures = await prisma.initiativeMeasure.findMany({ where: { initiativeId }, include: { readings: true } });
  const pct = derivedPct(input.actual, input.target, measures) ?? before.pctComplete;
  const after = await prisma.initiative.update({
    where: { id: initiativeId },
    data: { progressActual: input.actual, progressTarget: input.target, pctComplete: pct },
  });
  await audit(actor.id, "UPDATE", "Initiative", initiativeId, {
    before: { pctComplete: before.pctComplete, progressActual: before.progressActual, progressTarget: before.progressTarget },
    after: { pctComplete: after.pctComplete, progressActual: after.progressActual, progressTarget: after.progressTarget },
  });
  revalidateInitiatives();
  return { ok: true, id: initiativeId };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function addMilestone(actor: Actor, initiativeId: string, input: { title: string; owner?: string | null; dueAt?: string | Date | null }): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const title = clean(input.title, 300);
  if (!title) return { ok: false, error: "A milestone needs a title." };
  if (!(await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { id: true } }))) return NO_INITIATIVE;
  const count = await prisma.initiativeMilestone.count({ where: { initiativeId } });
  const created = await prisma.initiativeMilestone.create({
    data: { initiativeId, title, owner: clean(input.owner, 200), dueAt: dayOf(input.dueAt), order: count },
  });
  await audit(actor.id, "CREATE", "InitiativeMilestone", created.id, { after: { initiativeId, title } });
  revalidateInitiatives();
  return { ok: true, id: created.id };
}

/** Change a milestone's title, owner or due day. Undefined leaves a field alone; null clears owner or due. */
export async function updateMilestone(actor: Actor, id: string, input: { title?: string; owner?: string | null; dueAt?: string | Date | null }): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const existing = await prisma.initiativeMilestone.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That milestone no longer exists." };
  const data: { title?: string; owner?: string | null; dueAt?: Date | null } = {};
  if (input.title !== undefined) {
    const title = clean(input.title, 300);
    if (!title) return { ok: false, error: "A milestone needs a title." };
    data.title = title;
  }
  if (input.owner !== undefined) data.owner = clean(input.owner, 200);
  if (input.dueAt !== undefined) data.dueAt = dayOf(input.dueAt);
  await prisma.initiativeMilestone.update({ where: { id }, data });
  await audit(actor.id, "UPDATE", "InitiativeMilestone", id, {
    before: { title: existing.title, owner: existing.owner, dueAt: existing.dueAt },
    after: data,
  });
  revalidateInitiatives();
  return { ok: true, id };
}

/** Mark a milestone done or not done ("toggle" flips it). Editors, its owner and the SI's lead may. */
export async function setMilestoneDone(actor: Actor, id: string, done: boolean | "toggle"): Promise<InitiativeEditResult> {
  const existing = await prisma.initiativeMilestone.findUnique({
    where: { id },
    select: { id: true, initiativeId: true, owner: true, completedAt: true, initiative: { select: ownerSelect } },
  });
  if (!existing) return { ok: false, error: "That milestone no longer exists." };
  if (!leadsOrEdits(actor, existing.initiative) && existing.owner !== actor.name) {
    return { ok: false, error: "Only editors, the milestone's owner and the SI's lead can mark it done." };
  }
  const want = done === "toggle" ? !existing.completedAt : done;
  if (want === Boolean(existing.completedAt)) return { ok: true, id };
  const completedAt = want ? new Date() : null;
  await prisma.initiativeMilestone.update({ where: { id }, data: { completedAt } });
  await audit(actor.id, "UPDATE", "InitiativeMilestone", id, { before: { completedAt: existing.completedAt }, after: { completedAt } });
  revalidateInitiatives();
  return { ok: true, id };
}

export async function removeMilestone(actor: Actor, id: string): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const existing = await prisma.initiativeMilestone.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That milestone no longer exists." };
  await prisma.initiativeMilestone.delete({ where: { id } });
  await audit(actor.id, "DELETE", "InitiativeMilestone", id, { before: { title: existing.title } });
  revalidateInitiatives();
  return { ok: true, id: existing.initiativeId };
}

// ---------------------------------------------------------------------------
// Action items (actions and dependencies)
// ---------------------------------------------------------------------------

export async function addActionItem(
  actor: Actor,
  initiativeId: string,
  input: { title: string; owner: string; kind?: string | null; dueAt?: string | Date | null },
): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const title = clean(input.title, 300);
  const owner = clean(input.owner, 200);
  if (!title || !owner) return { ok: false, error: "An action item needs a title and an owner." };
  if (!(await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { id: true } }))) return NO_INITIATIVE;
  const kind = (ACTION_KINDS as readonly string[]).includes(input.kind ?? "") ? input.kind! : "ACTION";
  const count = await prisma.initiativeActionItem.count({ where: { initiativeId } });
  const created = await prisma.initiativeActionItem.create({
    data: { initiativeId, kind, title, owner, dueAt: dayOf(input.dueAt), order: count },
  });
  await audit(actor.id, "CREATE", "InitiativeActionItem", created.id, { after: { initiativeId, kind, title, owner } });
  revalidateInitiatives();
  return { ok: true, id: created.id };
}

/** Mark an action item done or open ("toggle" flips it). Editors, its owner and the SI's lead may. */
export async function setActionItemDone(actor: Actor, id: string, done: boolean | "toggle"): Promise<InitiativeEditResult> {
  const existing = await prisma.initiativeActionItem.findUnique({
    where: { id },
    select: { id: true, status: true, owner: true, initiative: { select: ownerSelect } },
  });
  if (!existing) return { ok: false, error: "That action item no longer exists." };
  if (!leadsOrEdits(actor, existing.initiative) && existing.owner !== actor.name) {
    return { ok: false, error: "Only editors, the item's owner and the SI's lead can mark it done." };
  }
  const want = done === "toggle" ? existing.status !== "DONE" : done;
  const status = want ? "DONE" : "OPEN";
  if (status === existing.status) return { ok: true, id };
  await prisma.initiativeActionItem.update({ where: { id }, data: { status } });
  await audit(actor.id, "UPDATE", "InitiativeActionItem", id, { before: { status: existing.status }, after: { status } });
  revalidateInitiatives();
  return { ok: true, id };
}

export async function removeActionItem(actor: Actor, id: string): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const existing = await prisma.initiativeActionItem.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That action item no longer exists." };
  await prisma.initiativeActionItem.delete({ where: { id } });
  await audit(actor.id, "DELETE", "InitiativeActionItem", id, { before: { title: existing.title } });
  revalidateInitiatives();
  return { ok: true, id: existing.initiativeId };
}

// ---------------------------------------------------------------------------
// ELT asks (support and investment requests)
// ---------------------------------------------------------------------------

export async function addEltRequest(
  actor: Actor,
  initiativeId: string,
  input: { request: string; kind?: string | null; amount?: number | null },
): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const request = clean(input.request, 2000);
  if (!request) return { ok: false, error: "An ELT ask needs a request." };
  if (!(await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { id: true } }))) return NO_INITIATIVE;
  const kind = (ELT_KINDS as readonly string[]).includes(input.kind ?? "") ? input.kind! : "SUPPORT";
  const count = await prisma.initiativeEltRequest.count({ where: { initiativeId } });
  const created = await prisma.initiativeEltRequest.create({
    data: { initiativeId, request, kind, amount: kind === "INVESTMENT" ? (input.amount ?? null) : null, order: count },
  });
  await audit(actor.id, "CREATE", "InitiativeEltRequest", created.id, { after: { initiativeId, kind, request } });
  revalidateInitiatives();
  return { ok: true, id: created.id };
}

/** Record ELT's decision: status and/or the decision note (undefined keeps it). */
export async function updateEltRequest(actor: Actor, id: string, input: { status?: string | null; decidedNote?: string | null }): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const existing = await prisma.initiativeEltRequest.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That ELT ask no longer exists." };
  if (input.status && !(ELT_STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: "Unknown status." };
  const status = input.status || existing.status;
  const decidedNote = input.decidedNote === undefined ? existing.decidedNote : clean(input.decidedNote, 2000);
  await prisma.initiativeEltRequest.update({ where: { id }, data: { status, decidedNote } });
  await audit(actor.id, "UPDATE", "InitiativeEltRequest", id, { before: { status: existing.status, decidedNote: existing.decidedNote }, after: { status, decidedNote } });
  revalidateInitiatives();
  return { ok: true, id };
}

export async function removeEltRequest(actor: Actor, id: string): Promise<InitiativeEditResult> {
  if (!canEdit(actor.role)) return NOT_EDITOR;
  const existing = await prisma.initiativeEltRequest.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That ELT ask no longer exists." };
  await prisma.initiativeEltRequest.delete({ where: { id } });
  await audit(actor.id, "DELETE", "InitiativeEltRequest", id, { before: { request: existing.request } });
  revalidateInitiatives();
  return { ok: true, id: existing.initiativeId };
}

// ---------------------------------------------------------------------------
// Measures (KPIs and leading measures) and their readings. An SI's own lead
// keeps these up to date, so they pass as well as editors.
// ---------------------------------------------------------------------------

/** A value initiative's percent follows its measures unless dollars drive it. Returns the percent now stored. */
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

async function measureAccess(actor: Actor, initiativeId: string): Promise<InitiativeEditResult | null> {
  const initiative = await prisma.initiative.findUnique({ where: { id: initiativeId }, select: ownerSelect });
  if (!initiative) return NO_INITIATIVE;
  if (!leadsOrEdits(actor, initiative)) return { ok: false, error: "Only editors and the SI's lead can change its measures." };
  return null;
}

export type MeasureInput = { name: string; kind?: string | null; unit?: string | null; baseline?: string | number | null; target?: string | number | null };

const BAD_NUMBER = "Baseline and target must be numbers, e.g. 18, 12.5% or $1.5M.";

/** Name, kind, unit, baseline and target. A blank baseline or target is allowed; an unreadable one isn't. */
function measureFields(input: MeasureInput): { ok: true; data: { name: string; kind: string; unit: string; baseline: number | null; target: number | null } } | { ok: false; error: string } {
  const name = clean(input.name, 200);
  if (!name) return { ok: false, error: "A measure needs a name." };
  const number = (v: string | number | null | undefined) => (typeof v === "number" ? (Number.isFinite(v) ? v : NaN) : v == null || String(v).trim() === "" ? null : (parseMeasureValue(v) ?? NaN));
  const baseline = number(input.baseline);
  const target = number(input.target);
  if (Number.isNaN(baseline) || Number.isNaN(target)) return { ok: false, error: BAD_NUMBER };
  return {
    ok: true,
    data: {
      name,
      kind: (MEASURE_KINDS as readonly string[]).includes(input.kind ?? "") ? input.kind! : "KPI",
      unit: (MEASURE_UNITS as readonly string[]).includes(input.unit ?? "") ? input.unit! : "NUMBER",
      baseline,
      target,
    },
  };
}

export async function addMeasure(actor: Actor, initiativeId: string, input: MeasureInput): Promise<InitiativeEditResult> {
  const denied = await measureAccess(actor, initiativeId);
  if (denied) return denied;
  const fields = measureFields(input);
  if (!fields.ok) return fields;
  const { _max } = await prisma.initiativeMeasure.aggregate({ where: { initiativeId }, _max: { order: true } });
  const created = await prisma.initiativeMeasure.create({ data: { initiativeId, ...fields.data, order: (_max.order ?? -1) + 1 } });
  const pctComplete = await syncMeasurePct(initiativeId);
  await audit(actor.id, "CREATE", "InitiativeMeasure", created.id, { after: { initiativeId, ...fields.data, pctComplete } });
  revalidateInitiatives();
  return { ok: true, id: created.id };
}

/** Edit a measure. Fields left undefined keep their saved value. */
export async function updateMeasure(actor: Actor, id: string, input: Partial<MeasureInput>): Promise<InitiativeEditResult> {
  const existing = await prisma.initiativeMeasure.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That measure no longer exists." };
  const denied = await measureAccess(actor, existing.initiativeId);
  if (denied) return denied;
  const fields = measureFields({
    name: input.name ?? existing.name,
    kind: input.kind ?? existing.kind,
    unit: input.unit ?? existing.unit,
    baseline: input.baseline === undefined ? existing.baseline : input.baseline,
    target: input.target === undefined ? existing.target : input.target,
  });
  if (!fields.ok) return fields;
  await prisma.initiativeMeasure.update({ where: { id }, data: fields.data });
  const pctComplete = await syncMeasurePct(existing.initiativeId);
  await audit(actor.id, "UPDATE", "InitiativeMeasure", id, { before: existing, after: { ...fields.data, pctComplete } });
  revalidateInitiatives();
  return { ok: true, id };
}

/** Move a KPI ahead of the others, which makes it the one percent complete follows. */
export async function setPrimaryMeasure(actor: Actor, id: string): Promise<InitiativeEditResult> {
  const existing = await prisma.initiativeMeasure.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That measure no longer exists." };
  const denied = await measureAccess(actor, existing.initiativeId);
  if (denied) return denied;
  const { _min } = await prisma.initiativeMeasure.aggregate({ where: { initiativeId: existing.initiativeId }, _min: { order: true } });
  const order = (_min.order ?? 0) - 1;
  await prisma.initiativeMeasure.update({ where: { id }, data: { order } });
  const pctComplete = await syncMeasurePct(existing.initiativeId);
  await audit(actor.id, "UPDATE", "InitiativeMeasure", id, { before: { order: existing.order }, after: { order, pctComplete } });
  revalidateInitiatives();
  return { ok: true, id };
}

export async function removeMeasure(actor: Actor, id: string): Promise<InitiativeEditResult> {
  const existing = await prisma.initiativeMeasure.findUnique({ where: { id }, include: { readings: true } });
  if (!existing) return { ok: false, error: "That measure no longer exists." };
  const denied = await measureAccess(actor, existing.initiativeId);
  if (denied) return denied;
  await prisma.initiativeMeasure.delete({ where: { id } });
  const pctComplete = await syncMeasurePct(existing.initiativeId);
  await audit(actor.id, "DELETE", "InitiativeMeasure", id, { before: existing, after: { pctComplete } });
  revalidateInitiatives();
  return { ok: true, id: existing.initiativeId };
}

/** Log a measure's latest value. The as-of day defaults to today and can't be in the future. */
export async function addMeasureReading(
  actor: Actor,
  measureId: string,
  input: { value: string | number; asOf?: string | Date | null; note?: string | null },
): Promise<InitiativeEditResult> {
  const measure = await prisma.initiativeMeasure.findUnique({ where: { id: measureId }, select: { initiativeId: true } });
  if (!measure) return { ok: false, error: "That measure no longer exists." };
  const denied = await measureAccess(actor, measure.initiativeId);
  if (denied) return denied;
  const value = typeof input.value === "number" ? (Number.isFinite(input.value) ? input.value : null) : parseMeasureValue(input.value);
  if (value === null) return { ok: false, error: "Enter the latest value as a number, e.g. 18, 12.5% or $1.5M." };
  const now = appNow();
  const asOf = input.asOf ? dayOf(input.asOf) : now;
  if (!asOf) return { ok: false, error: "Give the as-of day as YYYY-MM-DD." };
  // A day's grace: a picker's "today" can be ahead of the server's in some time zones.
  if (asOf.getTime() > now.getTime() + 24 * 60 * 60 * 1000) return { ok: false, error: "The as-of date can't be in the future." };
  const note = clean(input.note, 2000);
  const created = await prisma.initiativeMeasureReading.create({ data: { measureId, value, asOf, note, enteredBy: actor.name } });
  const pctComplete = await syncMeasurePct(measure.initiativeId);
  await audit(actor.id, "CREATE", "InitiativeMeasureReading", created.id, { after: { measureId, value, asOf, note, pctComplete } });
  revalidateInitiatives();
  return { ok: true, id: created.id };
}

export async function removeMeasureReading(actor: Actor, id: string): Promise<InitiativeEditResult> {
  const existing = await prisma.initiativeMeasureReading.findUnique({ where: { id }, include: { measure: { select: { initiativeId: true } } } });
  if (!existing) return { ok: false, error: "That reading no longer exists." };
  const denied = await measureAccess(actor, existing.measure.initiativeId);
  if (denied) return denied;
  const { measure, ...before } = existing;
  await prisma.initiativeMeasureReading.delete({ where: { id } });
  const pctComplete = await syncMeasurePct(measure.initiativeId);
  await audit(actor.id, "DELETE", "InitiativeMeasureReading", id, { before, after: { pctComplete } });
  revalidateInitiatives();
  return { ok: true, id: measure.initiativeId };
}
