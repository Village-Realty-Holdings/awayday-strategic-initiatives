import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { authErrorText } from "../src/lib/auth-error-text";
import { DEFAULT_SIGN_IN_CALLBACK, signInCallbackURL } from "../src/lib/sign-in-callback";

describe("login page: ?error= from a failed OAuth round trip", () => {
  it("is empty when there is no code", () => {
    expect(authErrorText(undefined)).toBe("");
  });
  it("names the known codes in plain English", () => {
    expect(authErrorText("invalid_code")).toMatch(/Microsoft accepted the sign-in/);
    expect(authErrorText("state_mismatch")).toMatch(/expired or started on a different address/);
  });
  it("still shows an unknown code rather than hiding it", () => {
    expect(authErrorText("something_new")).toBe("Sign-in failed (something_new).");
  });
  it("returns sign-in links to the standalone app rather than Talent", () => {
    // No ?redirect= → this app's own home ("/", the Initiatives overview, which
    // bounces users without the grant to the /apps launcher). Never Talent.
    expect(DEFAULT_SIGN_IN_CALLBACK).toBe("/");
    expect(signInCallbackURL(null)).toBe("/");
    expect(signInCallbackURL("")).toBe("/");
    expect(signInCallbackURL("/initiatives/abc")).toBe("/initiatives/abc");
    // Off-site targets fall back to home rather than leaving the app.
    expect(signInCallbackURL("https://talent.example.com/talent/home")).toBe("/");
    expect(signInCallbackURL("//evil.example.com")).toBe("/");
    expect(signInCallbackURL("/\\evil.example.com")).toBe("/");
    // Both the magic-link and Microsoft calls go through the helper.
    const source = readFileSync(new URL("../src/app/login/login-form.tsx", import.meta.url), "utf8");
    const magicLinkCall = source.match(/authClient\.signIn\.magicLink\(\{([\s\S]*?)\}\)/)?.[1];
    const socialCall = source.match(/authClient\.signIn\.social\(\{([\s\S]*?)\}\)/)?.[1];
    expect(magicLinkCall).toContain("signInCallbackURL(");
    expect(socialCall).toContain("signInCallbackURL(");
    expect(source).not.toContain("/talent/");
  });
});
