"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveSection, usePageSections } from "@/components/shell/section-nav";
import {
  LayoutDashboard,
  Target,
  FileText,
  Compass,
  Layers,
  type LucideIcon,
} from "lucide-react";

type Item = { label: string; href: string; icon: LucideIcon };

const NAV: Item[] = [
  { label: "Strategy Review", href: "/", icon: LayoutDashboard },
  { label: "Initiatives", href: "/initiatives", icon: Target },
  { label: "Groups", href: "/groups", icon: Layers },
  { label: "Strategy Sources", href: "/sources", icon: Compass },
  { label: "Reporting", href: "/reporting", icon: FileText },
];

export function SidebarNav() {
  const pathname = usePathname();
  // In-page sections of the Strategy Review, shown under its item while on it.
  const sections = usePageSections();
  const activeSection = useActiveSection(sections);
  // Longest matching href wins so nested routes (/initiatives/new) highlight
  // only the most specific item, not every prefix.
  const activeHref = NAV.map((i) => i.href)
    .filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="flex flex-col gap-1">
      <p className="px-3 pb-5 text-sm font-semibold tracking-tight text-ink">Strategic Initiatives</p>
      {NAV.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;
        const subs = item.href === "/" && active ? sections : [];
        return (
          <div key={item.href} className="flex flex-col gap-1">
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-navy/10 font-medium text-navy-deep"
                : "text-ink-muted hover:bg-surface hover:text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden />
            {item.label}
          </Link>
          {subs.length > 0 && (
            <ul aria-label={`${item.label} sections`} className="mb-1 ml-[1.15rem] flex flex-col border-l border-border pl-2">
              {subs.map((sec) => {
                const on = sec.id === activeSection;
                return (
                  <li
                    key={sec.id}
                    className={`relative ${on ? "before:absolute before:-left-[9px] before:inset-y-1 before:w-0.5 before:rounded-full before:bg-navy" : ""}`}
                  >
                    <a
                      href={`#${sec.id}`}
                      aria-current={on ? "location" : undefined}
                      className={`block truncate rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                        on ? "bg-navy/10 font-medium text-navy-deep" : "text-ink-muted hover:bg-surface hover:text-ink"
                      }`}
                    >
                      {sec.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
        );
      })}
    </nav>
  );
}
