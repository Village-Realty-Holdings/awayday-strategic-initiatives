import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireSession, getSessionUserRow } from "@/lib/session";
import { hasApp } from "@/lib/apps";
import { AppShell } from "@/components/shell/app-shell";
import { parseThemePreference, THEME_COOKIE } from "@/lib/theme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { user } = session;
  const dbUser = await getSessionUserRow(user.id);
  // App-entitlement gate for everything under the shell. Users without the
  // grant land on /no-access, which says so and offers sign-out.
  if (!hasApp(user.role, dbUser?.appAccess, "initiatives")) redirect("/no-access");
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
  return <AppShell user={user} theme={theme}>{children}</AppShell>;
}
