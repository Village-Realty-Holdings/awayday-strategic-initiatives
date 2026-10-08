import Image from "next/image";
import Link from "next/link";
import { LayoutGrid, ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

// Platform-level chrome (no app sidebar). Houses settings that span both apps —
// People & access — so they're reachable from either app without belonging to
// one. Any signed-in user may view; the pages gate management themselves.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header data-chrome className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-4">
          <Image src="/awayday-logo.png" alt="Awayday" width={475} height={101} className="h-6 w-auto" priority />
          <Link href="/apps" className="group inline-flex items-center gap-1.5 rounded-md border border-navy/30 bg-navy/5 px-2.5 py-1.5 text-xs font-semibold text-navy-deep transition-colors hover:border-navy hover:bg-navy hover:text-white">
            <ArrowLeft size={13} strokeWidth={2.25} className="transition-transform group-hover:-translate-x-0.5" aria-hidden />
            <LayoutGrid size={13} aria-hidden /> All apps
          </Link>
        </div>
        <SignOutButton />
      </header>
      <main className="flex-1 px-6 py-7">{children}</main>
    </div>
  );
}
