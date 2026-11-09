import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getActivePlan } from "@/lib/active-plan";
import { PUBLICATION_APPROVED, PUBLICATION_SUPERSEDED } from "@/lib/kpi";
import { getReviewPlan } from "@/lib/review-data";
import { MANUAL_MEASURE_IDENTITY, MANUAL_SOURCE_CATEGORY } from "@/lib/review-kpi";
import { parseStatus } from "@/lib/initiatives";
import { canEdit } from "@/lib/roles";
import { initiativeOwnerMatches, isoDay, normalizeSoWhats, parseIsoDay, PERIOD_PATTERN, PILLAR_STATUSES, SUMMARY_SCOPE, type PillarStatus } from "@/lib/review-model";
import { recordSiUpdate } from "@/lib/si-updates";

// ---------------------------------------------------------------------------
// Monthly review edits, shared by Edit Mode's server actions and the MCP
// endpoint. Callers authenticate (cookie session or MCP OAuth token) and pass the
// actor; everything after that (permission, the published-month lock, plan
// membership, audit and revalidation) happens here, so the two can't drift.
// ---------------------------------------------------------------------------

export type Actor = { id: string; name: string; role?: string | null };

export type EditResult = { ok: true } | { ok: false; error: string };

export const LOCKED: EditResult = { ok: false, error: "This month is published. Unpublish it on the review editor to make changes." };
const FORBIDDEN: EditResult = { ok: false, error: "Only admins and editors can change the review." };
const UNKNOWN_MONTH: EditResult = { ok: false, error: "Unknown review month." };

export function revalidateReview() {
  revalidatePath("/", "layout");
}

function validPeriod(id: string | null | undefined): id is string {
  return Boolean(id && PERIOD_PATTERN.test(id));
}

async function isPublished(id: string): Promise<boolean> {
  const row = await prisma.reviewPeriod.findUnique({ where: { id }, select: { status: true } });
  return row?.status === "PUBLISHED";
}

const trimmed = (v: string | null | undefined, max: number) => v?.trim().slice(0, max) || null;

// ---------------------------------------------------------------------------
// Review details
// ---------------------------------------------------------------------------

/** Each field: undefined leaves it as it is, null (or blank) clears it. Days are YYYY-MM-DD. */
export type ReviewDetailsInput = {
  periodId: string;
  preparedBy?: string | null;
  meetingDate?: string | null;
  updatesDueDate?: string | null;
  dataAsOf?: string | null;
};

/** The month's header: prepared by, meeting date, updates due and data as of. */
export async function updateReviewDetails(actor: Actor, input: ReviewDetailsInput): Promise<EditResult> {
  if (!canEdit(actor.role)) return FORBIDDEN;
  const id = input.periodId;
  if (!validPeriod(id)) return UNKNOWN_MONTH;
  const existing = await prisma.reviewPeriod.findUnique({
    where: { id },
    select: { status: true, preparedBy: true, meetingDate: true, updatesDueDate: true, dataAsOf: true },
  });
  if (existing?.status === "PUBLISHED") return LOCKED;
  const day = (v: string | null | undefined, current: Date | null | undefined) => (v === undefined ? (current ?? null) : parseIsoDay(v));
  const fields = {
    preparedBy: input.preparedBy === undefined ? (existing?.preparedBy ?? null) : trimmed(input.preparedBy, 120),
    meetingDate: day(input.meetingDate, existing?.meetingDate),
    updatesDueDate: day(input.updatesDueDate, existing?.updatesDueDate),
    dataAsOf: day(input.dataAsOf, existing?.dataAsOf),
  };
  await prisma.reviewPeriod.upsert({ where: { id }, create: { id, ...fields }, update: fields });
  const days = (p: typeof fields) => ({ preparedBy: p.preparedBy, meetingDate: isoDay(p.meetingDate), updatesDueDate: isoDay(p.updatesDueDate), dataAsOf: isoDay(p.dataAsOf) });
  await audit(actor.id, existing ? "UPDATE" : "CREATE", "ReviewPeriod", id, { before: existing ? days(existing) : undefined, after: days(fields) });
  revalidateReview();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// So-whats
// ---------------------------------------------------------------------------

/**
 * Replace the so-whats of one scope (the summary or one area of the active
 * plan) for the month. `items` are `{ scope, headline, body }`; rows for any
 * other scope are dropped. Saving creates the month as a draft if it isn't stored.
 */
export async function setSoWhats(actor: Actor, input: { periodId: string; scope: string; items: unknown }): Promise<EditResult> {
  if (!canEdit(actor.role)) return FORBIDDEN;
  const { periodId: id, scope } = input;
  if (!validPeriod(id) || !scope) return UNKNOWN_MONTH;
  const existing = await prisma.reviewPeriod.findUnique({
    where: { id },
    select: { status: true, soWhats: { where: { scope }, orderBy: { order: "asc" }, select: { headline: true } } },
  });
  if (existing?.status === "PUBLISHED") return LOCKED;
  const plan = await getReviewPlan(id);
  if (scope !== SUMMARY_SCOPE && !plan.areas.some((a) => a.code === scope)) return { ok: false, error: "That pillar is not in the active plan." };
  const soWhats = normalizeSoWhats(input.items, [scope]);

  await prisma.$transaction([
    prisma.reviewPeriod.upsert({ where: { id }, create: { id, preparedBy: actor.name }, update: {} }),
    prisma.reviewSoWhat.deleteMany({ where: { periodId: id, scope } }),
    prisma.reviewSoWhat.createMany({ data: soWhats.map((s) => ({ periodId: id, ...s })) }),
  ]);
  await audit(actor.id, "UPDATE", "ReviewSoWhat", `${id}:${scope}`, {
    before: existing?.soWhats.map((s) => s.headline) ?? [],
    after: soWhats.map((s) => s.headline),
  });
  revalidateReview();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// SI updates
// ---------------------------------------------------------------------------

/**
 * An SI's update for the month (status, latest progress, what next), stored as
 * a new InitiativeUpdate like the ones leads save in Inbox. Admins, editors and
 * the SI's own lead may save one. An unknown status is stored as none.
 */
export async function addSiUpdate(
  actor: Actor,
  input: { periodId: string; initiativeId: string; status?: string | null; update?: string | null; pathForward?: string | null },
): Promise<EditResult> {
  const id = input.periodId;
  if (!validPeriod(id)) return UNKNOWN_MONTH;
  const initiative = await prisma.initiative.findUnique({ where: { id: input.initiativeId }, select: { id: true, ownerUserId: true, teamLead: true } });
  if (!initiative) return { ok: false, error: "That SI no longer exists." };
  if (!canEdit(actor.role) && !initiativeOwnerMatches({ ownerUserId: initiative.ownerUserId ?? null, teamLead: initiative.teamLead ?? null }, actor)) {
    return { ok: false, error: "Only admins, editors and the SI's lead can update it." };
  }
  if (await isPublished(id)) return LOCKED;
  const status = parseStatus(input.status);
  const created = await recordSiUpdate({
    initiativeId: initiative.id,
    status,
    update: trimmed(input.update, 10_000),
    pathForward: trimmed(input.pathForward, 10_000),
    reportingPeriod: id,
    updatedBy: actor.name,
  });
  await audit(actor.id, "CREATE", "InitiativeUpdate", created.id, { after: { initiativeId: initiative.id, status, reportingPeriod: id } });
  revalidateReview();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pillar measure value and status
// ---------------------------------------------------------------------------

export type PillarMeasureInput = {
  periodId: string;
  areaId: string;
  /** undefined leaves the value alone; null or blank clears the hand-typed value. */
  value?: string | null;
  /** undefined leaves the status alone; "calculated" goes back to the status worked out from value and target. */
  status?: string | null;
};

/**
 * A pillar's measure value for the month, typed in by hand. Stored as an
 * approved KpiObservation on the area's KPI under MANUAL_MEASURE_IDENTITY, with
 * every value kept in KpiObservationRevision. Saving again revises it; a blank
 * value supersedes it. A value loaded from a document is never overwritten.
 *
 * Pillars can also have their status set by hand for the month.
 */
export async function setPillarMeasure(actor: Actor, input: PillarMeasureInput): Promise<EditResult> {
  if (!canEdit(actor.role)) return FORBIDDEN;
  const id = input.periodId;
  if (!validPeriod(id)) return UNKNOWN_MONTH;
  if (await isPublished(id)) return LOCKED;
  const plan = await getActivePlan();
  const area = await prisma.strategicArea.findUnique({
    where: { id: input.areaId },
    // Same order as getReviewPlan, so this is the KPI the review shows.
    select: { planVersionId: true, kind: true, kpis: { orderBy: { name: "asc" }, take: 1, select: { id: true } } },
  });
  if (!plan || !area || area.planVersionId !== plan.id) return { ok: false, error: "That pillar is not in the active plan." };
  const kpiId = area.kpis[0]?.id;
  if (!kpiId) return { ok: false, error: "This pillar has no KPI definition to hold a value." };
  const statusField = input.status || null;
  if (statusField && area.kind === "ENABLER") return { ok: false, error: "Only pillars can have a status set by hand." };
  if (statusField && statusField !== "calculated" && !(PILLAR_STATUSES as readonly string[]).includes(statusField)) return { ok: false, error: "Unknown status." };

  if (input.value !== undefined) {
    const saved = await saveMeasureValue(actor, kpiId, id, trimmed(input.value, 60));
    if (!saved.ok) return saved;
  }
  if (statusField) await saveMeasureStatus(actor, input.areaId, id, statusField === "calculated" ? null : (statusField as PillarStatus));
  return { ok: true };
}

async function saveMeasureStatus(actor: Actor, areaId: string, id: string, status: PillarStatus | null) {
  const where = { periodId_strategicAreaId: { periodId: id, strategicAreaId: areaId } };
  const before = await prisma.reviewPillarStatus.findUnique({ where, select: { id: true, status: true } });
  if ((before?.status ?? null) === status) return;
  if (status) {
    await prisma.reviewPeriod.upsert({ where: { id }, create: { id, preparedBy: actor.name }, update: {} });
    const row = await prisma.reviewPillarStatus.upsert({
      where,
      create: { periodId: id, strategicAreaId: areaId, status, updatedBy: actor.name },
      update: { status, updatedBy: actor.name },
      select: { id: true },
    });
    await audit(actor.id, before ? "UPDATE" : "CREATE", "ReviewPillarStatus", row.id, { before: { status: before?.status ?? null }, after: { status, periodId: id, areaId } });
  } else {
    await prisma.reviewPillarStatus.delete({ where });
    await audit(actor.id, "DELETE", "ReviewPillarStatus", before!.id, { before: { status: before!.status, periodId: id, areaId } });
  }
  revalidateReview();
}

async function saveMeasureValue(actor: Actor, kpiId: string, id: string, value: string | null): Promise<EditResult> {
  const { sourceRef, ...identity } = MANUAL_MEASURE_IDENTITY;
  const result = await prisma.$transaction(async (tx): Promise<EditResult & { before?: string | null; observationId?: string }> => {
    const approved = await tx.kpiObservation.findFirst({
      where: { kpiId, reportingPeriod: id, publicationState: PUBLICATION_APPROVED, ...identity },
      select: { id: true, value: true, sourceRef: true, sourceDocumentName: true },
    });
    if (approved && approved.sourceRef !== sourceRef) {
      const from = approved.sourceDocumentName ? ` from ${approved.sourceDocumentName}` : "";
      return { ok: false, error: `This month's value was loaded${from}. Change it at the source.` };
    }
    if (!value) {
      if (approved) await tx.kpiObservation.update({ where: { id: approved.id }, data: { publicationState: PUBLICATION_SUPERSEDED, supersededAt: new Date() } });
      return { ok: true, before: approved?.value ?? null, observationId: approved?.id };
    }
    if (approved?.value === value) return { ok: true };

    // The manual row for this month, approved or cleared earlier.
    const existing = approved ?? (await tx.kpiObservation.findFirst({ where: { kpiId, reportingPeriod: id, sourceRef, ...identity }, select: { id: true, value: true } }));
    const now = new Date();
    const fields = { value, observedAt: now, refreshedAt: now, quality: "VALID", publicationState: PUBLICATION_APPROVED, supersededAt: null };
    const row = existing
      ? await tx.kpiObservation.update({ where: { id: existing.id }, data: { ...fields, revision: { increment: 1 } }, select: { id: true, revision: true } })
      : await tx.kpiObservation.create({
          data: { kpiId, reportingPeriod: id, sourceRef, ...identity, ...fields, sourceCategory: MANUAL_SOURCE_CATEGORY, valueDerivation: "REPORTED", evidence: `Entered on the review by ${actor.name}` },
          select: { id: true, revision: true },
        });
    await tx.kpiObservationRevision.create({
      data: {
        observationId: row.id,
        revision: row.revision,
        value,
        reportingScope: identity.reportingScope,
        comparisonBasis: identity.comparisonBasis,
        timeBasis: identity.timeBasis,
        entityId: identity.entityId,
        sourceDocumentId: sourceRef,
        sourceCategory: MANUAL_SOURCE_CATEGORY,
        valueDerivation: "REPORTED",
        evidence: `Entered on the review by ${actor.name}`,
        observedAt: now,
      },
    });
    return { ok: true, before: existing?.value ?? null, observationId: row.id };
  });
  if (!result.ok) return result;
  if (result.observationId) {
    await audit(actor.id, "UPDATE", "KpiObservation", result.observationId, { before: { value: result.before }, after: { kpiId, reportingPeriod: id, value } });
    revalidateReview();
  }
  return { ok: true };
}
