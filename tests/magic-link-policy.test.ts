import { describe, it, expect } from "vitest";
import { maskEmail, magicLinkAllowed } from "../src/lib/magic-link-policy";

// The plugin creates an account for any address it is given, which would make
// the app an open relay. Delivery is allowed only to existing accounts.

describe("magicLinkAllowed", () => {
  it("lets an existing account holder sign in without a password", () => {
    expect(magicLinkAllowed({ isExistingUser: true })).toBe(true);
  });

  it("refuses an address we have never heard of, so we cannot be used to mail strangers", () => {
    expect(magicLinkAllowed({ isExistingUser: false })).toBe(false);
  });
});

describe("maskEmail", () => {
  it("shows the first character and the domain, so the reader can tell it is their address", () => {
    expect(maskEmail("rpearson@awayday.com")).toBe("r•••••••@awayday.com");
  });

  it("masks a single-character local part without revealing its length as zero", () => {
    expect(maskEmail("a@awayday.com")).toBe("a•@awayday.com");
  });

  it("leaves anything that is not an address alone rather than guessing", () => {
    expect(maskEmail("not-an-email")).toBe("");
    expect(maskEmail("")).toBe("");
  });

  it("is case preserving on the domain and trims surrounding space", () => {
    // "Beth.OBerry" is 11 characters, so one shown and ten hidden.
    expect(maskEmail("  Beth.OBerry@Awayday.com ")).toBe("B••••••••••@Awayday.com");
  });
});
