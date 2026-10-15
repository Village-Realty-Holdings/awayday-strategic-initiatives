import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// The active plan (fiscal year) is the single source of truth for which
// initiatives the dashboard shows. Every initiative listing / aggregate goes
// through activePlanInitiativeWhere() so all views agree on the fiscal year.
// Memoized per request (React cache()); no cross-request caching so switching
// the active plan is reflected immediately.
export const getActivePlan = cache(async () =>
  prisma.planVersion.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, code: true, title: true },
  }),
);

// Where-clause scoping initiatives to a plan. With no plan (none active) the
// clause is empty, i.e. every initiative is listed rather than hiding data.
export function planInitiativeWhere(plan: { id: string } | null): Prisma.InitiativeWhereInput {
  return plan ? { planVersionId: plan.id } : {};
}

// Scope to the active plan, AND-ed with any extra filter.
export async function activePlanInitiativeWhere(extra?: Prisma.InitiativeWhereInput): Promise<Prisma.InitiativeWhereInput> {
  const scope = planInitiativeWhere(await getActivePlan());
  return extra ? { AND: [scope, extra] } : scope;
}

// Strategic areas of a plan, in display order, for the initiative form's Area picker.
export async function getPlanAreas(planId: string | null | undefined) {
  if (!planId) return [];
  return prisma.strategicArea.findMany({
    where: { planVersionId: planId },
    orderBy: [{ kind: "asc" }, { order: "asc" }],
    select: { id: true, code: true, name: true, kind: true },
  });
}
