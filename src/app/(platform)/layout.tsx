import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/shell/app-shell";

// Platform pages (People & access, roster) span apps, so they have no
// entitlement gate: any signed-in user may view and the pages gate management
// themselves. They render inside the same shell as the main app.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return <AppShell user={user}>{children}</AppShell>;
}
