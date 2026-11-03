import { devToday } from "@/lib/clock";
import { activePlanInitiativeWhere } from "@/lib/active-plan";
import { isDevTestingEnabled } from "@/lib/dev-testing";
import { listBackups, readRememberedAccount } from "@/lib/dev-testing-files";
import { prisma } from "@/lib/prisma";
import { getReviewPeriodIndex } from "@/lib/review-data";
import { periodLabel, splitNames, updatePeriods } from "@/lib/review-model";
import { DevTestingDialog } from "./dev-testing-dialog";

/** The local testing tool. Renders nothing unless all its guards hold. */
export async function DevTestingTool({ role }: { role?: string | null }) {
  if (!isDevTestingEnabled()) return null;
  const [backups, account, index, initiatives] = await Promise.all([
    listBackups(),
    readRememberedAccount(),
    getReviewPeriodIndex(),
    prisma.initiative.findMany({ where: await activePlanInitiativeWhere(), select: { teamLead: true } }),
  ]);
  const leads = [...new Set(initiatives.flatMap((i) => splitNames(i.teamLead)))].sort();
  const months = updatePeriods(index.periods).map((id) => ({ id, label: periodLabel(id), published: index.published.includes(id) }));
  return <DevTestingDialog role={role ?? "user"} accountChanged={account !== null} backups={backups} leads={leads} months={months} today={devToday()} />;
}
