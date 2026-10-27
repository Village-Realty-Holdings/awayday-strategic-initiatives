"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { str, date } from "@/lib/form";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { getReviewPlan } from "@/lib/review-data";
import { requireAdmin, requireSession, canEdit } from "@/lib/session";
import {
  BELOW_LINE_STATUSES,
  initiativeOwnerMatches,
  isoDay,
  parseIsoDay,
  parseSoWhats,
  PERIOD_PATTERN,
  periodLabel,
  SI_REVIEW_STATUSES,
  SUMMARY_SCOPE,
  type SiReviewStatus,
} from "@/lib/review-model";


function revalidateReview() {
  revalidatePath("/", "layout");
}

/** An SI lead's monthly update: review status, latest progress and what next. */
export async function saveInitiativeUpdate(formData: FormData) {
  const session = await requireSession();
  const initiativeId = String(formData.get("initiativeId") ?? "");
  const rawPeriod = str(formData, "reportingPeriod");
  const period = rawPeriod && PERIOD_PATTERN.test(rawPeriod) ? rawPeriod : null;
  const [initiative, review] = await Promise.all([
    prisma.initiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, status: true, ownerUserId: true, teamLead: true },
    }),
    period ? prisma.reviewPeriod.findUnique({ where: { id: period }, select: { status: true } }) : null,
  ]);
  if (!initiative) redirect("/my");
  if (!canEdit(session.user.role) && !initiativeOwnerMatches(initiative, session.user)) redirect("/my");
  // A published review is final: its month takes no more updates, for anyone.
  if (review?.status === "PUBLISHED") redirect(`/my?period=${period}`);

  const rawStatus = str(formData, "reviewStatus");
  const reviewStatus = SI_REVIEW_STATUSES.includes(rawStatus as SiReviewStatus) ? (rawStatus as SiReviewStatus) : null;
  const created = await prisma.initiativeUpdate.create({
    data: {
      initiativeId,
      // Lifecycle status is copied, not changed: the review status is separate.
      status: initiative.status,
      reviewStatus,
      update: str(formData, "update"),
      pathForward: str(formData, "pathForward"),
      nextMilestone: str(formData, "nextMilestone"),
      milestoneDueAt: date(formData, "milestoneDueAt"),
      reportingPeriod: period,
      updatedBy: session.user.name,
    },
  });
  await audit(session.user.id, "CREATE", "InitiativeUpdate", created.id, { after: { initiativeId, reviewStatus, reportingPeriod: created.reportingPeriod } });
  revalidateReview();
  redirect(`/my${period ? `?period=${period}` : ""}#si-${initiativeId}`);
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
  const name = str(formData, "name");
  if (!name) redirect("/below-the-line");
  const area = await prisma.strategicArea.findUnique({ where: { id: strategicAreaId }, select: { id: true } });
  if (!area) redirect("/below-the-line");
  const initiativeId = str(formData, "initiativeId");
  if (initiativeId) {
    const initiative = await prisma.initiative.findFirst({ where: { id: initiativeId, strategicAreaId }, select: { id: true } });
    if (!initiative) redirect("/below-the-line");
  }
  const rawStatus = String(formData.get("status") ?? "");
  const created = await prisma.belowLineProject.create({
    data: {
      strategicAreaId,
      name,
      description: str(formData, "description"),
      owner: str(formData, "owner"),
      team: str(formData, "team"),
      status: BELOW_LINE_STATUSES.includes(rawStatus as (typeof BELOW_LINE_STATUSES)[number]) ? rawStatus : "NOT_STARTED",
      dueAt: date(formData, "dueAt"),
      initiativeId,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });
  await audit(session.user.id, "CREATE", "BelowLineProject", created.id, { after: { strategicAreaId, name, initiativeId } });
  revalidatePath("/below-the-line");
  redirect("/below-the-line");
}

// ---------------------------------------------------------------------------
// Review authoring (Strategy, admins only): the period and its so-whats
// ---------------------------------------------------------------------------

function periodId(formData: FormData, key = "periodId"): string | null {
  const id = str(formData, key);
  return id && PERIOD_PATTERN.test(id) ? id : null;
}

/** Start a review month as a draft (or open it when it already exists). */
export async function createReviewPeriod(formData: FormData) {
  const session = await requireAdmin();
  const id = periodId(formData, "period");
  if (!id) redirect("/");
  const existing = await prisma.reviewPeriod.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    await prisma.reviewPeriod.create({ data: { id, preparedBy: session.user.name } });
    await audit(session.user.id, "CREATE", "ReviewPeriod", id, { after: { status: "DRAFT", preparedBy: session.user.name } });
    revalidateReview();
    await flash(`${periodLabel(id)} review started`);
  }
  redirect(`/review/${id}/edit`);
}

/**
 * Save the month's header fields and so-whats; with intent=publish, publish it
 * too. A published month is read-only until it is unpublished. So-whats are
 * replaced as a set for the scopes the active plan has (the summary and each
 * area), so rows for areas of another plan are left alone.
 */
export async function saveReview(formData: FormData) {
  const session = await requireAdmin();
  const id = periodId(formData);
  if (!id) redirect("/");
  const editPath = `/review/${id}/edit`;
  const existing = await prisma.reviewPeriod.findUnique({
    where: { id },
    include: { soWhats: { orderBy: [{ scope: "asc" }, { order: "asc" }], select: { scope: true, headline: true } } },
  });
  if (existing?.status === "PUBLISHED") redirect(editPath);

  const plan = await getReviewPlan(id);
  const scopes = [SUMMARY_SCOPE, ...plan.areas.map((a) => a.code)];
  const soWhats = parseSoWhats(str(formData, "soWhats"), scopes);
  const publish = formData.get("intent") === "publish";
  const fields = {
    preparedBy: str(formData, "preparedBy"),
    meetingDate: parseIsoDay(str(formData, "meetingDate")),
    updatesDueDate: parseIsoDay(str(formData, "updatesDueDate")),
    dataAsOf: parseIsoDay(str(formData, "dataAsOf")),
    ...(publish ? { status: "PUBLISHED" as const, publishedAt: new Date(), publishedBy: session.user.name } : {}),
  };

  await prisma.$transaction([
    prisma.reviewPeriod.upsert({ where: { id }, create: { id, ...fields }, update: fields }),
    prisma.reviewSoWhat.deleteMany({ where: { periodId: id, scope: { in: scopes } } }),
    prisma.reviewSoWhat.createMany({ data: soWhats.map((s) => ({ periodId: id, ...s })) }),
  ]);
  const summary = (p: { status: string; preparedBy: string | null; meetingDate: Date | null; updatesDueDate: Date | null; dataAsOf: Date | null }) => ({
    status: p.status,
    preparedBy: p.preparedBy,
    meetingDate: isoDay(p.meetingDate),
    updatesDueDate: isoDay(p.updatesDueDate),
    dataAsOf: isoDay(p.dataAsOf),
  });
  await audit(session.user.id, existing ? "UPDATE" : "CREATE", "ReviewPeriod", id, {
    before: existing ? { ...summary(existing), soWhats: existing.soWhats } : undefined,
    after: { ...summary({ status: existing?.status ?? "DRAFT", ...fields }), soWhats: soWhats.map(({ scope, headline }) => ({ scope, headline })) },
  });
  revalidateReview();
  await flash(publish ? `${periodLabel(id)} review published` : "Review saved");
  redirect(publish ? `/review/${id}` : editPath);
}

/** Return a published month to draft, reopening it for edits and SI updates. */
export async function unpublishReview(formData: FormData) {
  const session = await requireAdmin();
  const id = periodId(formData);
  if (!id) redirect("/");
  const editPath = `/review/${id}/edit`;
  const existing = await prisma.reviewPeriod.findUnique({ where: { id }, select: { status: true, publishedAt: true, publishedBy: true } });
  if (existing?.status !== "PUBLISHED") redirect(editPath);
  await prisma.reviewPeriod.update({ where: { id }, data: { status: "DRAFT", publishedAt: null, publishedBy: null } });
  await audit(session.user.id, "UPDATE", "ReviewPeriod", id, { before: existing, after: { status: "DRAFT" } });
  revalidateReview();
  await flash(`${periodLabel(id)} review unpublished`);
  redirect(editPath);
}
