import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isMicrosoftSsoEnabled } from "@/lib/sso";
import { verifiedOAuthQuery } from "@/lib/oauth-query";
import { OAuthCard, OAuthLinkExpired } from "../oauth-card";
import { MicrosoftSignInButton } from "./microsoft-sign-in-button";

// Sign-in step of "Connect Claude" (the OAuth provider's loginPage and
// postLogin page). Microsoft Entra only: someone already signed in to the app
// with a password or a sign-in link lands here too and is asked to use
// Microsoft. After Microsoft sends them back, the provider carries on to the
// consent page by itself.
export default async function OAuthSignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await verifiedOAuthQuery(await searchParams);
  if (!query) return <OAuthLinkExpired />;

  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  const ssoEnabled = isMicrosoftSsoEnabled(process.env);

  return (
    <OAuthCard>
      <h1 className="text-lg font-semibold text-ink">Connect Claude</h1>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        {session
          ? "Connecting Claude needs a Microsoft sign-in, even though you're already signed in to the app another way."
          : "Sign in with your Awayday Microsoft account to let Claude work with Strategic Initiatives as you."}
      </p>
      <div className="mt-4">
        {ssoEnabled ? (
          <MicrosoftSignInButton />
        ) : (
          <p className="text-xs text-risk">Microsoft sign-in isn&apos;t set up on this site yet, so Claude can&apos;t be connected. Ask an admin.</p>
        )}
      </div>
    </OAuthCard>
  );
}
