import { describe, it, expect } from "vitest";
import { isMicrosoftSsoEnabled, microsoftProviderFromEnv } from "../src/lib/sso";

const CREDS = {
  MICROSOFT_CLIENT_ID: "004c30de-2e48-4d39-88c0-a7717b282cba",
  MICROSOFT_CLIENT_SECRET: "secret-value",
  MICROSOFT_TENANT_ID: "34b336e5-1f8c-4a90-ab9d-819749be6b27",
};

describe("Microsoft/Entra SSO gating (dark until configured)", () => {
  it("is disabled when no credentials are present (prod default)", () => {
    expect(isMicrosoftSsoEnabled({})).toBe(false);
    expect(microsoftProviderFromEnv({})).toBeUndefined();
  });

  it("stays disabled if only one of id/secret is set", () => {
    expect(isMicrosoftSsoEnabled({ MICROSOFT_CLIENT_ID: "x" })).toBe(false);
    expect(isMicrosoftSsoEnabled({ MICROSOFT_CLIENT_SECRET: "y" })).toBe(false);
    expect(microsoftProviderFromEnv({ MICROSOFT_CLIENT_ID: "x" })).toBeUndefined();
  });

  it("builds a tenant-pinned provider when fully configured", () => {
    expect(isMicrosoftSsoEnabled(CREDS)).toBe(true);
    expect(microsoftProviderFromEnv(CREDS)).toEqual({
      clientId: CREDS.MICROSOFT_CLIENT_ID,
      clientSecret: CREDS.MICROSOFT_CLIENT_SECRET,
      tenantId: CREDS.MICROSOFT_TENANT_ID,
      prompt: "select_account",
    });
  });

  it("fails closed (stays dark) when the tenant is unset — never multi-tenant 'common'", () => {
    const { MICROSOFT_TENANT_ID: _omit, ...noTenant } = CREDS;
    void _omit;
    expect(isMicrosoftSsoEnabled(noTenant)).toBe(false);
    expect(microsoftProviderFromEnv(noTenant)).toBeUndefined();
  });
});
