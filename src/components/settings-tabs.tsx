"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, Users, ShieldCheck, Archive, type LucideIcon } from "lucide-react";

type Tab = { label: string; href: string; icon: LucideIcon; adminOnly?: boolean };

const TABS: Tab[] = [
  { label: "Change password", href: "/settings/password", icon: KeyRound },
  { label: "People & access", href: "/settings/people", icon: Users },
  { label: "Admin settings", href: "/settings/admin", icon: ShieldCheck, adminOnly: true },
  { label: "Archive", href: "/settings/archive", icon: Archive },
];

export function SettingsTabs({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  return (
    <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
              active
                ? "border-navy font-medium text-navy-deep"
                : "border-transparent text-ink-muted hover:text-ink"
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
