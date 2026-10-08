import { describe, it, expect } from "vitest";
import { confirmLinkFor, safeVerifyTarget } from "./sign-in-confirm";

const BASE = "https://awayday-app.vercel.app";
const VERIFY = `${BASE}/api/auth/magic-link/verify?token=abc123&callbackURL=%2Fpartners%2Fprogram`;

describe("confirmLinkFor", () => {
  it("emails our confirm page instead of the verify endpoint, so a scanner's GET spends nothing", () => {
    const out = confirmLinkFor(VERIFY, BASE);
    expect(out.startsWith(`${BASE}/login/confirm?to=`)).toBe(true);
    expect(out).not.toContain("/api/auth/magic-link/verify?token"); // only as an encoded parameter
    expect(safeVerifyTarget(new URL(out).searchParams.get("to"), BASE)).toBe(VERIFY);
  });

  it("keeps the token and the callback intact through the round trip", () => {
    const back = safeVerifyTarget(new URL(confirmLinkFor(VERIFY, BASE)).searchParams.get("to"), BASE)!;
    const u = new URL(back);
    expect(u.searchParams.get("token")).toBe("abc123");
    expect(u.searchParams.get("callbackURL")).toBe("/partners/program");
  });

  it("tolerates a trailing slash on the configured base url", () => {
    expect(confirmLinkFor(VERIFY, `${BASE}/`).startsWith(`${BASE}/login/confirm?`)).toBe(true);
  });

  it("falls back to the original link rather than emailing a broken one", () => {
    expect(confirmLinkFor("not-a-url", BASE)).toBe("not-a-url");
  });
});

describe("safeVerifyTarget", () => {
  it("accepts our own verify endpoint", () => {
    expect(safeVerifyTarget(VERIFY, BASE)).toBe(VERIFY);
  });

  it("refuses another origin, so the confirm page is never an open redirect", () => {
    expect(safeVerifyTarget("https://evil.example.com/api/auth/magic-link/verify?token=x", BASE)).toBeNull();
  });

  it("refuses a different path on our own origin", () => {
    expect(safeVerifyTarget(`${BASE}/partners/program`, BASE)).toBeNull();
    expect(safeVerifyTarget(`${BASE}/api/auth/magic-link/verify/../../evil`, BASE)).toBeNull();
  });

  it("refuses a protocol-relative or javascript target", () => {
    expect(safeVerifyTarget("//evil.example.com/api/auth/magic-link/verify", BASE)).toBeNull();
    expect(safeVerifyTarget("javascript:alert(1)", BASE)).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(safeVerifyTarget(null, BASE)).toBeNull();
    expect(safeVerifyTarget("", BASE)).toBeNull();
  });
});
