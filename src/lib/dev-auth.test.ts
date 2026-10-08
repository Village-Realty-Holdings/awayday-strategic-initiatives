import { describe, it, expect } from "vitest";
import { devAuthEmail, isDevAuthEnabled } from "./dev-auth";

const on = { NODE_ENV: "development", DEV_AUTH_AS: "michael@opticommerceai.com" };

describe("devAuthEmail", () => {
  it("returns the named user in local development", () => {
    expect(devAuthEmail(on)).toBe("michael@opticommerceai.com");
    expect(isDevAuthEnabled(on)).toBe(true);
  });

  // The two guards. Each one alone must be enough to shut it off.
  it("is off in a production build, even with the variable set", () => {
    expect(devAuthEmail({ ...on, NODE_ENV: "production" })).toBeNull();
  });

  it("is off unless a user is explicitly named", () => {
    expect(devAuthEmail({ NODE_ENV: "development" })).toBeNull();
    expect(devAuthEmail({ NODE_ENV: "development", DEV_AUTH_AS: "" })).toBeNull();
    expect(devAuthEmail({ NODE_ENV: "development", DEV_AUTH_AS: "   " })).toBeNull();
  });

  it("is off for an empty environment", () => {
    expect(devAuthEmail({})).toBeNull();
    expect(isDevAuthEnabled({})).toBe(false);
  });

  it("trims the configured email", () => {
    expect(devAuthEmail({ NODE_ENV: "development", DEV_AUTH_AS: "  a@b.com \n" })).toBe("a@b.com");
  });

  it("defaults to off rather than on for an unknown NODE_ENV", () => {
    // "test" is not production, so the variable still governs.
    expect(devAuthEmail({ NODE_ENV: "test" })).toBeNull();
  });
});
