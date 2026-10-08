import { describe, it, expect } from "vitest";
import { exemptFromAppTotp } from "../src/lib/mfa-policy";

describe("app TOTP enrolment: only password holders must enrol", () => {
  it("password (credential) account must enrol", () => {
    expect(exemptFromAppTotp([{ providerId: "credential", password: "hash" }])).toBe(false);
  });

  it("Microsoft-only account is exempt (Entra handles MFA)", () => {
    expect(exemptFromAppTotp([{ providerId: "microsoft", password: null }])).toBe(true);
  });

  it("sign-in-link user with no account rows is exempt", () => {
    expect(exemptFromAppTotp([])).toBe(true);
  });

  it("Microsoft-linked user who ALSO holds a password must still enrol", () => {
    expect(
      exemptFromAppTotp([
        { providerId: "microsoft", password: null },
        { providerId: "credential", password: "hash" },
      ]),
    ).toBe(false);
  });
});

// The same rule drives the /setup-mfa page, which stays reachable by URL even
// though requireSession no longer routes passwordless accounts to it. Before
// 18 September it showed a password box unconditionally, so an account with no
// password could sign in, land here and never get out. Mohan Chandolu hit it
// live on the tuck-in call.
describe("the /setup-mfa password step follows the same rule", () => {
  const needsPassword = (accounts: { providerId: string; password: string | null }[]) =>
    !exemptFromAppTotp(accounts);

  it("shows no password box to an account that has no password", () => {
    expect(needsPassword([{ providerId: "microsoft", password: null }])).toBe(false);
    expect(needsPassword([])).toBe(false);
  });

  it("still asks a password holder to confirm it", () => {
    expect(needsPassword([{ providerId: "credential", password: "hash" }])).toBe(true);
  });
});
