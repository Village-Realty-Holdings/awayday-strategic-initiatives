import Image from "next/image";
import { Settings, ShieldCheck } from "@/components/icons";
import { SidebarNav } from "@/components/shell/nav";
import { FooterLink } from "@/components/shell/footer-link";
import { SignOutButton } from "@/components/sign-out-button";
import { BreadcrumbProvider, Breadcrumbs } from "@/components/shell/breadcrumbs";
import { InsetScrollReset } from "@/components/shell/inset-scroll-reset";
import { AskPanel } from "@/components/ask-panel";
import { FlashToaster } from "@/components/flash-toaster";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Shared app chrome (sidebar, header strip, footer, flash toaster). Layouts
// own their auth/access checks and pass the session user in.
export function AppShell({
  user,
  children,
}: {
  user: { name: string; email?: string | null; role?: string | null };
  children: React.ReactNode;
}) {
  return (
    <BreadcrumbProvider>
    <div className="app-shell flex h-dvh overflow-hidden bg-bg">
      <aside data-chrome className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-5">
          <Image
            src="/awayday-logo.png"
            alt="Awayday"
            width={475}
            height={101}
            className="h-6 w-auto"
            priority
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav />
        </div>
        <FooterLink href="/settings" match={["/settings"]}>
          <Settings size={16} strokeWidth={1.75} aria-hidden />
          Settings
        </FooterLink>
        {user.role === "admin" && (
          <FooterLink href="/admin" match={["/admin"]}>
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
            Admin
          </FooterLink>
        )}
        <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy/10 text-note font-semibold text-navy-deep">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium text-ink">{user.name}</p>
            <p className="truncate text-micro text-ink-faint">
              {user.role === "admin" ? "Admin" : "Member"}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar is level with the logo row; its bottom border continues the
            logo row's, so sidebar and top bar form one white frame. */}
        <header data-chrome className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">
          <Breadcrumbs />
          <AskPanel />
        </header>
        {/* Content area: the page's scroll container, framed by the sidebar
            and top bar. */}
        <div className="app-inset flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
          <InsetScrollReset />
          <main className="flex-1 px-6 py-7">{children}</main>
          <footer data-chrome className="border-t border-border bg-surface px-6 py-4 text-center text-note text-ink-faint">
            Awayday Strategic Initiatives · Confidential · for Awayday leadership. Changes are versioned in the audit log.
          </footer>
        </div>
      </div>
      <FlashToaster />
    </div>
    </BreadcrumbProvider>
  );
}
