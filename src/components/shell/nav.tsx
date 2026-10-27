"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, Target, Layers, CalendarDays, FileText, type AppIcon } from "@/components/icons";

/** Text and active-state classes shared by sidebar nav and footer links. */
export function navLinkState(active: boolean) {
  return cn(
    "text-sm transition-colors",
    active ? "bg-navy/10 font-medium text-navy-deep" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
  );
}

type Item = { label: string; href: string; icon: AppIcon };

const NAV: Item[] = [
  { label: "Strategy Review", href: "/", icon: LayoutDashboard },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "My SIs", href: "/my", icon: Target },
  { label: "Below the line", href: "/below-the-line", icon: Layers },
  { label: "Timeline", href: "/timeline", icon: CalendarDays },
  { label: "Reporting", href: "/reporting", icon: FileText },
];

export function SidebarNav() {
  const pathname = usePathname();
  const items = NAV;
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
            className={cn("flex items-center gap-2.5 rounded-md px-3 py-2", navLinkState(active))}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
