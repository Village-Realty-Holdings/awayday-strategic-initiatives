import { prisma } from "@/lib/prisma";
import { requireSession, canEdit } from "@/lib/session";
import { activePlanInitiativeWhere } from "@/lib/active-plan";
import { GroupsManager } from "@/components/groups-manager";
import { PAGE_FRAME } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "Groups — Awayday" };

export default async function GroupsPage() {
  const [session, where] = await Promise.all([requireSession(), activePlanInitiativeWhere()]);
  const editable = canEdit(session.user.role);
  const [groups, initiatives] = await Promise.all([
    prisma.initiativeGroup.findMany({
      orderBy: [{ archived: "asc" }, { name: "asc" }],
      include: { initiatives: { select: { id: true, code: true, name: true }, orderBy: { code: "asc" } } },
    }),
    prisma.initiative.findMany({ where, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);

  const data = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    archived: g.archived,
    members: g.initiatives,
  }));

  return (
    <div className={PAGE_FRAME}>
      <GroupsManager groups={data} initiatives={initiatives} editable={editable} />
    </div>
  );
}
