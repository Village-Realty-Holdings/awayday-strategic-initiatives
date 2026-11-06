"use server";

import { prisma } from "@/lib/prisma";
import { str, lines } from "@/lib/form";
import { audit } from "@/lib/audit";
import { getActivePlan } from "@/lib/active-plan";
import { requireEditor } from "@/lib/session";
import {
  addSiUpdate,
  revalidateReview,
  setPillarMeasure,
  setSoWhats,
  updateReviewDetails,
  type EditResult,
  type PillarMeasureInput,
} from "@/lib/review-edits";

// ---------------------------------------------------------------------------
// Edit Mode on the Strategy Review (admins and editors). Each dialog saves one
// section and gets a result back instead of a redirect, so it can close or
// show the error in place. The review edits themselves live in
// lib/review-edits.ts, shared with the MCP endpoint.
// ---------------------------------------------------------------------------

export type { EditResult };

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
  return updateReviewDetails(session.user, {
    periodId: str(fd, "periodId") ?? "",
    preparedBy: str(fd, "preparedBy"),
    meetingDate: str(fd, "meetingDate"),
    updatesDueDate: str(fd, "updatesDueDate"),
    dataAsOf: str(fd, "dataAsOf"),
  });
}

/**
 * Replace the so-whats of one scope (the summary or one area of the active
 * plan) for the month. Saving creates the month as a draft if it isn't stored.
 */
export async function editSoWhats(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  let items: unknown = [];
  try {
    items = JSON.parse(str(fd, "soWhats") ?? "[]");
  } catch {
    items = [];
  }
  return setSoWhats(session.user, { periodId: str(fd, "periodId") ?? "", scope: str(fd, "scope") ?? "", items });
}

/**
 * A pillar or enabler of the active plan: name, objective and owner, plus the
 * month's measure value and status when the form sends them (see editMeasureValue).
 */
export async function editStrategicArea(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  const plan = await getActivePlan();
  const id = str(fd, "areaId") ?? "";
  const before = await prisma.strategicArea.findUnique({ where: { id }, select: { planVersionId: true, name: true, goal: true, owner: true } });
  if (!plan || !before || before.planVersionId !== plan.id) return { ok: false, error: "That pillar is not in the active plan." };
  const name = str(fd, "name")?.slice(0, 120);
  if (!name) return { ok: false, error: "Give the pillar a name." };
  const after = { name, goal: str(fd, "goal")?.slice(0, 1000) ?? null, owner: str(fd, "owner")?.slice(0, 200) ?? null };
  // The pillar form also carries the month's measure value and status when it shows them.
  if (fd.has("value") || fd.has("pillarStatus")) {
    const measure = await setPillarMeasure(session.user, measureInput(fd));
    if (!measure.ok) return measure;
  }
  await prisma.strategicArea.update({ where: { id }, data: after });
  await audit(session.user.id, "UPDATE", "StrategicArea", id, { before: { name: before.name, goal: before.goal, owner: before.owner }, after });
  revalidateReview();
  return { ok: true };
}

/** An SI's update for the month (status, latest progress, what next). */
export async function editSiUpdate(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  return addSiUpdate(session.user, {
    periodId: str(fd, "periodId") ?? "",
    initiativeId: str(fd, "initiativeId") ?? "",
    status: str(fd, "status"),
    update: str(fd, "update"),
    pathForward: str(fd, "pathForward"),
  });
}

/**
 * A pillar's measure value and/or status for the month (see setPillarMeasure).
 * Each field is only saved when the form sends it.
 */
export async function editMeasureValue(fd: FormData): Promise<EditResult> {
  const session = await requireEditor();
  return setPillarMeasure(session.user, measureInput(fd));
}

function measureInput(fd: FormData): PillarMeasureInput {
  return {
    periodId: str(fd, "periodId") ?? "",
    areaId: str(fd, "areaId") ?? "",
    value: fd.has("value") ? str(fd, "value") : undefined,
    status: str(fd, "pillarStatus") ?? undefined,
  };
}
