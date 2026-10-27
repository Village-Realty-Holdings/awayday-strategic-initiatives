"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type LinkTab = { label: string; href: string; icon: AppIcon };

/** Underlined tab bar of links; the tab whose href prefixes the path is active. */
export function LinkTabs({ items, label }: { items: LinkTab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {items.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
              active ? "border-navy font-medium text-navy-deep" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <Icon size={15} strokeWidth={1.75} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
