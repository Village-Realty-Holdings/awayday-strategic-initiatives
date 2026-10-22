"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useSignOut } from "@/components/sign-out-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu({ user }: { user: { name: string; email?: string | null; role?: string | null } }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 text-ink-muted transition-colors outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-navy/30 data-[state=open]:bg-surface-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy/10 text-[11px] font-semibold text-navy-deep">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-40 truncate text-xs font-medium text-ink sm:block">{user.name}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="leading-tight">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          {user.email && <p className="truncate text-xs font-normal text-ink-muted">{user.email}</p>}
          <p className="mt-0.5 text-[10px] font-normal text-ink-faint">{user.role === "admin" ? "Admin" : "Member"}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
