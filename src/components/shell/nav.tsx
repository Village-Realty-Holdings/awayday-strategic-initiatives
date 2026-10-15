"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ChevronDown,
  Target,
  GanttChartSquare,
  FileText,
  Compass,
  MonitorCog,
  ShieldCheck,
  Layers,
  FlaskConical,
  ClipboardCheck,
  UserCheck,
  CalendarDays,
  Inbox,
  Users,
  BookOpen,
  ListTree,
  Database,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Item = { label: string; href?: string; icon: LucideIcon; soon?: boolean };
type Group = { label?: string; items: Item[]; collapsible?: boolean };

const NAV: Group[] = [
  { items: [{ label: "Overview", href: "/", icon: LayoutDashboard }] },
  {
    label: "Strategic Initiatives",
    items: [
      { label: "Initiatives", href: "/initiatives", icon: Target },
      { label: "Groups", href: "/groups", icon: Layers },
      { label: "Strategy Sources", href: "/sources", icon: Compass },
    ],
  },
  {
    label: "Reporting",
    items: [
      { label: "Gantt", href: "/gantt", icon: GanttChartSquare },
      { label: "Board Narrative", href: "/narrative", icon: FileText },
    ],
  },
  { label: "Modules", items: [{ label: "IT Dashboard", icon: MonitorCog, soon: true }] },
  {
    label: "V2 preview",
    items: [
      { label: "V2 home", href: "/v2", icon: FlaskConical },
      { label: "Strategy Review", href: "/v2/review", icon: ClipboardCheck },
      { label: "My SIs", href: "/v2/my", icon: UserCheck },
      { label: "Timeline", href: "/v2/timeline", icon: CalendarDays },
      { label: "Inbox", href: "/v2/inbox", icon: Inbox },
      { label: "Asks by leader", href: "/v2/asks", icon: Users },
      { label: "Below the line", href: "/v2/below-the-line", icon: ListTree },
      { label: "Definitions", href: "/v2/definitions", icon: BookOpen },
      { label: "Data inputs", href: "/v2/data", icon: Database },
    ],
  },
];

const ADMIN_GROUP: Group = {
  label: "Settings",
  items: [{ label: "Admin", href: "/admin", icon: ShieldCheck }],
};

export function SidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  // Per-group collapse overrides (collapsible groups only). Undefined = use the
  // default, which is open when the active route lives inside the group.
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const groups = isAdmin ? [...NAV, ADMIN_GROUP] : NAV;
  // Longest matching href wins so nested routes (/initiatives/new) highlight
  // only the most specific item, not every prefix.
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href)).filter(Boolean) as string[];
  const activeHref = hrefs
    .filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="flex flex-col gap-6">
      <p className="px-3 text-sm font-semibold tracking-tight text-ink">Strategic Initiatives</p>
      {groups.map((group, gi) => {
        const groupKey = group.label ?? String(gi);
        const hasActive = group.items.some((i) => i.href === activeHref);
        // Collapsible groups default open only when you're inside them.
        const expanded = group.collapsible ? (openOverride[groupKey] ?? hasActive) : true;
        return (
        <div key={gi} className="flex flex-col gap-1">
          {group.label && (group.collapsible ? (
            <button
              type="button"
              onClick={() => setOpenOverride((o) => ({ ...o, [groupKey]: !expanded }))}
              aria-expanded={expanded}
              className="flex items-center justify-between rounded-md px-3 pb-1 pt-0.5 text-[11px] font-medium text-ink-faint transition-colors hover:text-ink-muted"
            >
              <span>{group.label}</span>
              <ChevronDown size={13} strokeWidth={2} aria-hidden className={`transition-transform ${expanded ? "" : "-rotate-90"}`} />
            </button>
          ) : (
            <p className="px-3 pb-1 text-[11px] font-medium text-ink-faint">{group.label}</p>
          ))}
          {expanded && group.items.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            if (item.soon || !item.href) {
              return (
                <span
                  key={item.label}
                  className="flex cursor-default items-center justify-between rounded-md px-3 py-2 text-sm text-ink-faint"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} strokeWidth={1.75} aria-hidden />
                    {item.label}
                  </span>
                  <Badge variant="secondary" className="rounded px-1.5 text-[10px] text-ink-faint">
                    Soon
                  </Badge>
                </span>
              );
            }
            return (
              <Link
                key={item.label}
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
        </div>
        );
      })}
    </nav>
  );
}
