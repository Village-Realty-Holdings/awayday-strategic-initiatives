import Image from "next/image";
import { SidebarNav } from "@/components/shell/nav";
import { UserMenu } from "@/components/shell/user-menu";
import { AskPanel } from "@/components/ask-panel";
import { FlashToaster } from "@/components/flash-toaster";

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
    <div className="flex min-h-dvh">
      <aside data-chrome className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col self-start border-r border-border bg-surface">
        <div className="shrink-0 border-b border-border px-5 py-4">
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header data-chrome className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-surface/85 px-6 backdrop-blur">
          <p className="text-[11px] text-ink-faint">
            Confidential · for Awayday leadership
          </p>
          <div className="flex items-center gap-3">
            <AskPanel />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="flex-1 bg-bg px-6 py-7">{children}</main>
        <footer data-chrome className="border-t border-border bg-surface px-6 py-4 text-center text-[11px] text-ink-faint">
          Awayday Strategic Initiatives · Confidential · for Awayday leadership. Changes are versioned in the audit log.
        </footer>
      </div>
      <FlashToaster />
    </div>
  );
}
