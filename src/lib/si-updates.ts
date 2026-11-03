import type { InitiativeStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isNewestPeriod } from "@/lib/review-model";

export type SiUpdateInput = {
  initiativeId: string;
  status: InitiativeStatus | null;
  update: string | null;
  pathForward: string | null;
  reportingPeriod: string | null;
  updatedBy: string;
};

/**
 * Saves an SI's update. Its status becomes the SI's current one, unless the SI
 * already has an update for a newer month. A non-value SI's percent follows it.
 */
export async function recordSiUpdate(input: SiUpdateInput) {
  const { initiativeId, status, reportingPeriod } = input;
  const [initiative, others] = await Promise.all([
    prisma.initiative.findUnique({ where: { id: initiativeId }, select: { valueType: true } }),
    prisma.initiativeUpdate.findMany({ where: { initiativeId, reportingPeriod: { not: null } }, select: { reportingPeriod: true } }),
  ]);
  const isCurrent = status !== null && isNewestPeriod(reportingPeriod, others.map((u) => u.reportingPeriod));
  return prisma.$transaction(async (tx) => {
    const created = await tx.initiativeUpdate.create({ data: input });
    if (isCurrent) {
      await tx.initiative.update({
        where: { id: initiativeId },
        data: { status, ...(initiative?.valueType === "NON_VALUE" ? { pctComplete: status === "COMPLETE" ? 1 : 0 } : {}) },
      });
    }
    return created;
  });
}
