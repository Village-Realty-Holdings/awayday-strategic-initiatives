import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Compass, LayoutGrid, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { accessibleApps, type AppKey } from "@/lib/apps";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose an app — Awayday" };

const ICON: Record<AppKey, typeof Compass> = {
  initiatives: Compass,
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export default async function LauncherPage() {
  const session = await requireSession();
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, role: true, appAccess: true },
  });
  const apps = accessibleApps(u?.role ?? session.user.role, u?.appAccess);
  const isAdmin = (u?.role ?? session.user.role) === "admin";
  // Single-app deployment: entitled users go straight in. This page remains as
  // the landing spot for signed-in users without access (the shell redirects here).
  if (apps.length > 0) redirect(apps[0].href);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4">
        <Image src="/awayday-logo.png" alt="Awayday" width={475} height={101} className="h-6 w-auto" priority />
        <SignOutButton />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-8">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gold-deep">
            <LayoutGrid size={13} aria-hidden /> Awayday
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">
            Welcome back, {firstName(u?.name ?? session.user.name)}.
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {apps.length > 0 ? "Choose an application to open." : "You don't have access to any applications yet."}
          </p>
        </div>

        {apps.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-muted">
            Ask an administrator to grant you access. You can still sign out above.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {apps.map((a) => {
              const Icon = ICON[a.key];
              return (
                <Link
                  key={a.key}
                  href={a.href}
                  className="group flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-md"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy/10 text-navy-deep transition-colors group-hover:bg-navy group-hover:text-white">
                    <Icon size={20} aria-hidden />
                  </span>
                  <h2 className="mt-4 text-base font-semibold text-ink">{a.name}</h2>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gold-deep">{a.tagline}</p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{a.blurb}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-navy-deep">
                    Open <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            className="group mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm transition-all hover:border-navy/40 hover:shadow-md"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy/10 text-navy-deep transition-colors group-hover:bg-navy group-hover:text-white">
              <Settings size={16} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">Admin &amp; settings</span>
              <span className="block text-xs text-ink-muted">Logins, roles, people, and the Overview scoreboard.</span>
            </span>
            <ArrowRight size={15} className="shrink-0 text-navy-deep transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </main>

      <footer className="px-6 py-4 text-center text-[11px] text-ink-faint">
        Confidential · for Awayday leadership
      </footer>
    </div>
  );
}
