"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { FLASH_COOKIE } from "@/lib/flash-cookie";

// Shows the flash handed down by <FlashToaster /> once, then clears the cookie
// so a reload doesn't repeat it. `id` makes identical consecutive messages
// distinct and guards against Strict Mode's double effect.
export function FlashListener({ flash }: { flash: { id: string; kind: "success" | "error"; message: string } | null }) {
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!flash || seen.current === flash.id) return;
    seen.current = flash.id;
    if (flash.kind === "error") toast.error(flash.message);
    else toast.success(flash.message);
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  }, [flash]);
  return null;
}
