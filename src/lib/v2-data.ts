import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/active-plan";
import type { InitiativeStatus } from "@/generated/prisma/client";

export const V2_UPDATE_STATUSES = ["NOT_STARTED", "PLANNING", "IN_PROGRESS", "AT_RISK", "DONE"] as const;
export type V2UpdateStatus = (typeof V2_UPDATE_STATUSES)[number];

export const BELOW_LINE_STATUSES = ["NOT_STARTED", "ON_TRACK", "AT_RISK", "BLOCKED", "DONE"] as const;
export type BelowLineStatus = (typeof BELOW_LINE_STATUSES)[number];

export type ResolvedAreaKpi = {
  name: string;
  metricKey: string;
  value: string | null;
  target: string | null;
  period: string | null;
  quality: string;
  rag: "GREEN" | "AMBER" | "RED" | "GREY";
};

function numberFromText(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/[$,%\s,]/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function ragFor(value: string | null, target: string | null, quality: string): ResolvedAreaKpi["rag"] {
  if (quality === "UNAVAILABLE" || quality === "INVALID" || value === null) return "GREY";
  if (quality === "STALE") return "AMBER";
  const actual = numberFromText(value);
  const goal = numberFromText(target);
  if (actual === null || goal === null) return "GREY";
  const lowerIsBetter = Boolean(target?.trim().startsWith("<"));
  const higherIsBetter = Boolean(target?.trim().startsWith(">"));
  const good = lowerIsBetter ? actual <= goal : higherIsBetter ? actual >= goal : actual >= goal;
  const distance = goal === 0 ? 0 : Math.abs(actual - goal) / Math.abs(goal);
  if (good) return "GREEN";
  return distance <= 0.1 ? "AMBER" : "RED";
}

export async function getActiveV2Plan() {
  const plan = await getActivePlan();
  if (!plan) return null;
  return prisma.planVersion.findUnique({
    where: { id: plan.id },
    include: {
      strategicAreas: {
        orderBy: [{ kind: "asc" }, { order: "asc" }],
        include: {
          initiatives: {
            orderBy: { code: "asc" },
            include: {
              updates: { orderBy: { createdAt: "desc" }, take: 1 },
              milestones: { orderBy: [{ dueAt: "asc" }, { order: "asc" }] },
            },
          },
          kpis: {
            orderBy: { name: "asc" },
            include: {
              observations: { orderBy: { observedAt: "desc" }, take: 1 },
              overrides: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
}

export type ActiveV2Area = NonNullable<Awaited<ReturnType<typeof getActiveV2Plan>>>["strategicAreas"][number];

export function resolvedAreaKpis(area: ActiveV2Area): ResolvedAreaKpi[] {
  return area.kpis.map((definition) => {
    const override = definition.overrides[0];
    const observation = definition.observations[0];
    const value = override?.value ?? observation?.value ?? null;
    const period = override?.reportingPeriod ?? observation?.reportingPeriod ?? null;
    const quality = override ? "VALID" : observation?.quality ?? "UNAVAILABLE";
    return {
      name: definition.name,
      metricKey: definition.metricKey,
      value,
      target: definition.target,
      period,
      quality,
      rag: ragFor(value, definition.target, quality),
    };
  });
}

export function latestInitiativeUpdate(initiative: {
  updates: Array<{
    status: InitiativeStatus;
    update: string | null;
    pathForward: string | null;
    nextMilestone: string | null;
    milestoneDueAt: Date | null;
    reportingPeriod: string | null;
    updatedBy: string | null;
    createdAt: Date;
  }>;
}) {
  return initiative.updates[0] ?? null;
}

export function initiativeOwnerMatches(initiative: { ownerUserId: string | null; teamLead: string | null }, user: { id: string; name: string }) {
  return initiative.ownerUserId === user.id || initiative.teamLead === user.name;
}
