"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Database, Layers, LineChart, Target, Users, CalendarCheck, type AppIcon } from "@/components/icons";

type Tab = { label: string; href: string; icon: AppIcon };

const TABS: Tab[] = [
  { label: "People & access", href: "/admin/people", icon: Users },
  { label: "Groups", href: "/admin/groups", icon: Layers },
  { label: "Data sources", href: "/admin/data-sources", icon: Database },
  { label: "Initiatives", href: "/admin/initiatives", icon: Target },
  { label: "Archive", href: "/admin/archive", icon: Archive },
  { label: "Plan versions", href: "/admin/plans", icon: CalendarCheck },
  { label: "AI telemetry", href: "/admin/ai-telemetry", icon: LineChart },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
              active ? "border-navy font-medium text-navy-deep" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={15} strokeWidth={1.75} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
