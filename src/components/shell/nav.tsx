"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  FileText,
  Compass,
  Layers,
  type AppIcon,
} from "@/components/icons";

type Item = { label: string; href: string; icon: AppIcon };

const NAV: Item[] = [
  { label: "Strategy Review", href: "/", icon: LayoutDashboard },
  { label: "Initiatives", href: "/initiatives", icon: Target },
  { label: "Groups", href: "/groups", icon: Layers },
  { label: "Strategy Sources", href: "/sources", icon: Compass },
  { label: "Reporting", href: "/reporting", icon: FileText },
];

const V2_NAV: Item[] = [
  { label: "Summary", href: "/v2", icon: LayoutDashboard },
  { label: "Personal inbox", href: "/v2/inbox", icon: Target },
  { label: "Below the line", href: "/v2/below-the-line", icon: Layers },
  { label: "Data & definitions", href: "/v2/data", icon: Compass },
];

export function SidebarNav() {
  const pathname = usePathname();
  const items = pathname === "/v2" || pathname.startsWith("/v2/") ? V2_NAV : NAV;
  // Longest matching href wins so nested routes (/initiatives/new) highlight
  // only the most specific item, not every prefix.
  const activeHref = items.map((i) => i.href)
    .filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="flex flex-col gap-1">
      <p className="px-3 pb-5 text-sm font-semibold tracking-tight text-ink">Strategic Initiatives</p>
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-navy/10 font-medium text-navy-deep"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
