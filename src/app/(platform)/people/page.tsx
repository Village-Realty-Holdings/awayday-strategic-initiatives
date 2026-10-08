import { prisma } from "@/lib/prisma";
import { requireSession, canEdit } from "@/lib/session";
import { PeopleManager, type Person } from "@/components/people-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "People — Awayday" };

export default async function PeoplePage() {
  const session = await requireSession();
  const editable = canEdit(session.user.role);
  const isAdmin = session.user.role === "admin";

  const [roster, users] = await Promise.all([
    prisma.rosterMember.findMany({ orderBy: [{ department: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, twoFactorEnabled: true, appAccess: true } }),
  ]);

  // Merge roster members and login accounts by email (case-insensitive).
  const byKey = new Map<string, Person>();
  const keyFor = (email: string | null, fallback: string) => (email ? email.toLowerCase() : `roster:${fallback}`);

  for (const r of roster) {
    const key = keyFor(r.email, r.id);
    byKey.set(key, {
      key,
      rosterId: r.id,
      userId: null,
      name: r.name,
      email: r.email,
      position: r.position,
      department: r.department,
      role: null,
      appAccess: [],
      mfa: false,
      isSelf: false,
    });
  }
  for (const u of users) {
    const key = keyFor(u.email, u.id);
    const existing = byKey.get(key);
    if (existing) {
      existing.userId = u.id;
      existing.role = u.role ?? "user";
      existing.appAccess = u.appAccess ?? [];
      existing.mfa = Boolean(u.twoFactorEnabled);
      existing.isSelf = u.id === session.user.id;
      if (!existing.email) existing.email = u.email;
    } else {
      byKey.set(key, {
        key,
        rosterId: null,
        userId: u.id,
        name: u.name,
        email: u.email,
        position: null,
        department: null,
        role: u.role ?? "user",
        appAccess: u.appAccess ?? [],
        mfa: Boolean(u.twoFactorEnabled),
        isSelf: u.id === session.user.id,
      });
    }
  }

  const people = [...byKey.values()].sort((a, b) => {
    // Logged-in accounts first, then by name.
    if (Boolean(a.userId) !== Boolean(b.userId)) return a.userId ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">People &amp; access</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            The team directory and who can sign in, in one place. Anyone can be listed; grant a login
            and role to the ones who use the tool. Access is invite-only and every change is audited.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="People" value={String(people.length)} />
          <Stat label="With login" value={String(people.filter((p) => p.userId).length)} />
        </div>
      </header>

      <PeopleManager
        people={people}
        editable={editable}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="tabular text-lg font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}
