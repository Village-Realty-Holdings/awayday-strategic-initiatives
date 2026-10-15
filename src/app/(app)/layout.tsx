import { redirect } from "next/navigation";
import { requireSession, getSessionUserRow } from "@/lib/session";
import { hasApp } from "@/lib/apps";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { user } = session;
  const dbUser = await getSessionUserRow(user.id);
  // App-entitlement gate for everything under the shell. Users without the
  // grant land on /apps, which explains they have no access.
  if (!hasApp(user.role, dbUser?.appAccess, "initiatives")) redirect("/apps");
  return <AppShell user={user}>{children}</AppShell>;
}
