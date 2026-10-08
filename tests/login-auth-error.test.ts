import { describe, it, expect } from "vitest";
import { authErrorText } from "../src/lib/auth-error-text";

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
});
