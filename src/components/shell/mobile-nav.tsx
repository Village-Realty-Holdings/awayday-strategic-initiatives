"use client";

import { useState } from "react";
import { Menu } from "@/components/icons";
import { SidebarNav } from "@/components/shell/nav";
import { FooterLink } from "@/components/shell/footer-link";
import { SignOutButton } from "@/components/sign-out-button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Settings, ShieldCheck } from "@/components/icons";

/**
 * Narrow-screen navigation.
 *
 * The shell's sidebar is a fixed 240px column, which on a phone leaves almost no
 * room for the page: at 390px the content column was 150px wide and the top bar
 * overflowed. Below `md` the sidebar is hidden and this button opens the same
 * navigation in a left sheet, so every page (and the theme control in the top
 * bar) stays reachable at phone widths.
 *
 * It is the same SidebarNav and the same footer links as the sidebar, so there is
 * one source of navigation truth and no second menu to keep in step.
 */
export function MobileNav({ name, role }: { name: string; role?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="mobile-nav__trigger grid place-items-center md:hidden"
          aria-label="Open navigation"
          title="Navigation"
        >
          <Menu size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 max-w-[80vw] p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav />
          </div>
          <FooterLink href="/settings" match={["/settings"]}>
            <Settings size={16} strokeWidth={1.75} aria-hidden />
            Settings
          </FooterLink>
          {role === "admin" && (
            <FooterLink href="/admin" match={["/admin"]}>
              <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
              Admin
            </FooterLink>
          )}
          <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium text-ink">{name}</p>
              <p className="truncate text-micro text-ink-faint">{role === "admin" ? "Admin" : "Member"}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
