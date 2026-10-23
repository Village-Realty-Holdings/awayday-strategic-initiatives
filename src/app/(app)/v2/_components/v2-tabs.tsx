"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Summary", href: "/v2" },
  { label: "Personal inbox", href: "/v2/inbox" },
  { label: "Below the line", href: "/v2/below-the-line" },
  { label: "Data & definitions", href: "/v2/data" },
];

export function V2Tabs() {
  const pathname = usePathname() ?? "";
  const active = TABS.filter((t) => (t.href === "/v2" ? pathname === "/v2" : pathname === t.href || pathname.startsWith(t.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="V2 preview sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors ${
            t.href === active ? "bg-navy/10 font-medium text-navy-deep" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
