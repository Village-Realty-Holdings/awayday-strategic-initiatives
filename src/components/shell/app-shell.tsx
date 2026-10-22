import Image from "next/image";
import { Settings } from "lucide-react";
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
    <div className="app-shell flex h-dvh overflow-hidden bg-ground">
      <aside data-chrome className="flex h-full w-60 shrink-0 flex-col">
        <div className="flex h-14 shrink-0 items-center px-5">
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
        {/* Top bar sits on the sidebar ground, level with the logo, so sidebar
            and top bar frame the content card together. */}
        <header data-chrome className="flex h-14 shrink-0 items-center justify-between gap-4 pl-1 pr-4">
          <Breadcrumbs />
          <AskPanel />
        </header>
        {/* Inset content card: the page's scroll container, with a border and
            soft shadow, below the top bar and beside the sidebar. */}
        <div className="app-inset mb-2 mr-2 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-border-strong/70 bg-bg shadow-[0_1px_3px_rgb(0_0_0/0.06),0_10px_28px_-8px_rgb(0_0_0/0.16)]">
          <InsetScrollReset />
          <main className="flex-1 px-6 py-7">{children}</main>
          <footer data-chrome className="border-t border-border bg-surface px-6 py-4 text-center text-[11px] text-ink-faint">
            Awayday Strategic Initiatives · Confidential · for Awayday leadership. Changes are versioned in the audit log.
          </footer>
        </div>
      </div>
      <FlashToaster />
    </div>
    </BreadcrumbProvider>
  );
}
