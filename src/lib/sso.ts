// Microsoft Entra ID (Azure AD) SSO wiring, kept as pure, testable helpers so
// the gating logic can be unit-tested without booting better-auth or the DB.
//
// The provider is DARK by default: it only activates when the Entra credentials
// are present in the environment. Production stays password-only until the creds
// are added (see [[dark-launch-default]]), so this can ship safely before the
// Entra app registration redirect URIs are live.

export type MicrosoftProviderConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  prompt: "select_account";
};

type Env = Record<string, string | undefined>;

/**
 * Whether Microsoft/Entra SSO is configured in this environment. Requires the tenant
 * too: we only ever want single-tenant sign-in, so without a pinned tenant SSO stays
 * dark rather than risk degrading to the multi-tenant endpoint.
 */
export function isMicrosoftSsoEnabled(env: Env): boolean {
  return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && env.MICROSOFT_TENANT_ID);
}

/**
 * Build the better-auth `socialProviders.microsoft` config, or `undefined` when the
 * credentials (client id, secret, AND tenant) are not all present, which keeps the
 * provider dark.
 */
export function microsoftProviderFromEnv(env: Env): MicrosoftProviderConfig | undefined {
  if (!isMicrosoftSsoEnabled(env)) return undefined;
  return {
    clientId: env.MICROSOFT_CLIENT_ID!,
    clientSecret: env.MICROSOFT_CLIENT_SECRET!,
    // Pin to the specific Awayday tenant. We deliberately NEVER fall back to "common"
    // (multi-tenant), which would accept any Azure AD / personal Microsoft account and,
    // combined with trusted account-linking, become an account-takeover surface.
    tenantId: env.MICROSOFT_TENANT_ID!,
    prompt: "select_account",
  };
}
