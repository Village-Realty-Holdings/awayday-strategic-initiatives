import Image from "next/image";
import Link from "next/link";
import { Users, KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { requireSession, getSessionUserRow } from "@/lib/session";
import { hasApp } from "@/lib/apps";
import { SidebarNav } from "@/components/shell/nav";
import { SignOutButton } from "@/components/sign-out-button";
import { AskPanel } from "@/components/ask-panel";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { user } = session;
  const dbUser = await getSessionUserRow(user.id);
  // App-entitlement gate for everything under the shell. Users without the
  // grant land on /apps, which explains they have no access.
  if (!hasApp(user.role, dbUser?.appAccess, "initiatives")) redirect("/apps");
  return (
    <div className="flex min-h-dvh">
      <aside data-chrome className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <Image
            src="/awayday-logo.png"
            alt="Awayday"
            width={475}
            height={101}
            className="h-6 w-auto"
            priority
          />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav isAdmin={user.role === "admin"} />
        </div>
        <Link
          href="/people"
          className="flex items-center gap-2.5 border-t border-border px-4 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Users size={16} strokeWidth={1.75} aria-hidden />
          People &amp; access
        </Link>
        <Link
          href="/account"
          className="flex items-center gap-2.5 border-t border-border px-4 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <KeyRound size={16} strokeWidth={1.75} aria-hidden />
          Change password
        </Link>
        <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy/10 text-[11px] font-semibold text-navy-deep">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium text-ink">{user.name}</p>
            <p className="truncate text-[10px] text-ink-faint">
              {user.role === "admin" ? "Admin" : "Member"}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header data-chrome className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-surface/85 px-6 backdrop-blur">
          <p className="text-[11px] text-ink-faint">
            Confidential · for Awayday leadership
          </p>
          <AskPanel />
        </header>
        <main className="flex-1 bg-bg px-6 py-7">{children}</main>
        <footer data-chrome className="border-t border-border bg-surface px-6 py-4 text-center text-[11px] text-ink-faint">
          Awayday Strategic Initiatives · Confidential · for Awayday leadership. Changes are versioned in the audit log.
        </footer>
      </div>
    </div>
  );
}
