import Image from "next/image";
import { redirect } from "next/navigation";
import { Lock } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out-button";
import { hasApp } from "@/lib/apps";
import { getSessionUserRow, requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "No access — Awayday" };

// Where signed-in users without the Initiatives grant land (the (app) layout
// and requireApp send them here). Outside the app shell on purpose: nothing
// on it depends on app access. Sign-out is offered so they can switch account.
export default async function NoAccessPage() {
  const session = await requireSession();
  const u = await getSessionUserRow(session.user.id);
  if (hasApp(u?.role ?? session.user.role, u?.appAccess, "initiatives")) redirect("/");

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="w-full max-w-sm text-center">
        <Image src="/awayday-logo.png" alt="Awayday" width={475} height={101} className="mx-auto h-6 w-auto" priority />
        <span className="mx-auto mt-8 grid h-11 w-11 place-items-center rounded-xl bg-navy/10 text-navy-deep">
          <Lock size={20} aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink">You don&apos;t have access</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          You&apos;re signed in as <span className="font-medium text-ink">{session.user.email}</span>, but this account
          hasn&apos;t been given access to Strategic Initiatives. Ask an administrator to grant it, or sign in with a
          different account.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton label="Sign out" />
        </div>
      </div>
    </main>
  );
}
