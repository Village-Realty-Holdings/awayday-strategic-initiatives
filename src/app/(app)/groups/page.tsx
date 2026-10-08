import { prisma } from "@/lib/prisma";
import { requireSession, canEdit } from "@/lib/session";
import { GroupsManager } from "@/components/groups-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Groups — Awayday" };

export default async function GroupsPage() {
  const session = await requireSession();
  const editable = canEdit(session.user.role);
  const [groups, initiatives] = await Promise.all([
    prisma.initiativeGroup.findMany({
      orderBy: [{ archived: "asc" }, { name: "asc" }],
      include: { initiatives: { select: { id: true, code: true, name: true }, orderBy: { code: "asc" } } },
    }),
    prisma.initiative.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);

  const data = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    archived: g.archived,
    members: g.initiatives,
  }));

  return (
    <div className="mx-auto max-w-[1000px]">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Initiative Groups</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Build custom collections of initiatives (for example, &quot;Q3 Board Meeting&quot;). Groups
          become a filter on the Initiatives table so you can pull up exactly the set you need.
        </p>
      </header>
      <GroupsManager groups={data} initiatives={initiatives} editable={editable} />
    </div>
  );
}
