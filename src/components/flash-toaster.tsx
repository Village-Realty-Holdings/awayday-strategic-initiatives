import { cookies } from "next/headers";
import { FLASH_COOKIE, type FlashKind } from "@/lib/flash-cookie";
import { Toaster } from "@/components/ui/sonner";
import { FlashListener } from "@/components/flash-listener";

// Mounted once in the app shell. Renders the Sonner
// <Toaster /> and hands any pending flash cookie (see src/lib/flash.ts) to the
// client listener.
export async function FlashToaster() {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  let flash: { id: string; kind: FlashKind; message: string } | null = null;
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (typeof v?.id === "string" && typeof v?.message === "string") {
        flash = { id: v.id, kind: v.kind === "error" ? "error" : "success", message: v.message.slice(0, 200) };
      }
    } catch {
      // Malformed cookie: ignore.
    }
  }
  return (
    <>
      <Toaster />
      <FlashListener flash={flash} />
    </>
  );
}
