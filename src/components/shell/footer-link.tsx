"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar footer link with the same active treatment as SidebarNav items.
// `match` lists path prefixes that should light the link up.
export function FooterLink({
  href,
  match,
  children,
}: {
  href: string;
  match: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 border-t border-border px-4 py-2.5 text-sm transition-colors ${
        active
          ? "bg-navy/10 font-medium text-navy-deep"
          : "text-ink-muted hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
