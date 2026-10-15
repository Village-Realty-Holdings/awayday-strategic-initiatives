import { cookies } from "next/headers";
import { FLASH_COOKIE, type FlashKind } from "@/lib/flash-cookie";

/**
 * Flash toasts for server actions.
 *
 * Most actions end in `redirect()` / `revalidatePath()`, so the form that
 * submitted them is unmounted (or never sees a pending true -> false change)
 * and a client-side "on success" hook can't fire reliably, and can't tell a
 * success from an `?error=` redirect. Instead the action calls `flash()` on its
 * success path only: it sets a short-lived cookie. The app layouts render
 * `<FlashToaster />` (src/components/flash-toaster.tsx), which reads the cookie
 * during render, shows it as a Sonner toast on the client, then clears it.
 *
 * Next re-renders the layout for a redirecting action (the redirect target is
 * fetched as a full RSC render with the action's cookies forwarded), so the
 * toast appears on the destination page. Error cases keep their existing
 * `?error=` redirects and simply never set a flash.
 *
 * The cookie is unsigned and only ever shown to the user who holds it, so a
 * forged one just toasts text at themselves.
 */
export async function flash(message: string, kind: FlashKind = "success"): Promise<void> {
  const jar = await cookies();
  jar.set(FLASH_COOKIE, JSON.stringify({ id: crypto.randomUUID(), kind, message: message.slice(0, 200) }), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    // Readable by JS on purpose: the client clears it after showing the toast.
    httpOnly: false,
  });
}
