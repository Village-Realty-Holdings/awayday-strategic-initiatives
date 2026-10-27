"use client";

import { Database, Layers, LineChart, Target, Users, CalendarCheck } from "@/components/icons";
import { LinkTabs, type LinkTab } from "@/components/shell/link-tabs";

const TABS: LinkTab[] = [
  { label: "People & access", href: "/admin/people", icon: Users },
  { label: "Groups", href: "/admin/groups", icon: Layers },
  { label: "Data sources", href: "/admin/data-sources", icon: Database },
  { label: "Initiatives", href: "/admin/initiatives", icon: Target },
  { label: "Plan versions", href: "/admin/plans", icon: CalendarCheck },
  { label: "AI telemetry", href: "/admin/ai-telemetry", icon: LineChart },
];

export function AdminTabs() {
  return <LinkTabs items={TABS} label="Admin sections" />;
}
