import { describe, it, expect } from "vitest";
import { buildTrustedOrigins } from "../src/lib/trusted-origins";

describe("buildTrustedOrigins (no broad wildcard)", () => {
  it("never contains a wildcard origin", () => {
    const out = buildTrustedOrigins({ BETTER_AUTH_URL: "https://si.example.workers.dev" });
    expect(out.some((o) => o.includes("*"))).toBe(false);
  });

  it("always trusts localhost for next dev and wrangler preview", () => {
    const out = buildTrustedOrigins({});
    expect(out).toEqual(["http://localhost:3000", "http://localhost:8787"]);
  });

  it("trusts the deployment's configured URLs, https-prefixed, without trailing slash", () => {
    const out = buildTrustedOrigins({ BETTER_AUTH_URL: "si.example.workers.dev/", APP_URL: "https://si.awayday.com" });
    expect(out).toContain("https://si.example.workers.dev");
    expect(out).toContain("https://si.awayday.com");
  });

  it("de-dupes when BETTER_AUTH_URL and APP_URL match", () => {
    const out = buildTrustedOrigins({ BETTER_AUTH_URL: "https://a.dev", APP_URL: "https://a.dev" });
    expect(out.filter((o) => o === "https://a.dev")).toHaveLength(1);
  });
});
