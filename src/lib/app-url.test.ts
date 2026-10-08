import { afterEach, describe, expect, it } from "vitest";
import { canonicalAppUrl } from "./app-url";

// wrangler's generated types make the configured vars required on
// process.env; tests need to unset them.
const env = process.env as Record<string, string | undefined>;
const saved = { APP_URL: env.APP_URL, BETTER_AUTH_URL: env.BETTER_AUTH_URL };
afterEach(() => {
  env.APP_URL = saved.APP_URL;
  env.BETTER_AUTH_URL = saved.BETTER_AUTH_URL;
});

describe("canonicalAppUrl", () => {
  it("prefers the configured URL over a deployment-specific request host", () => {
    delete env.APP_URL;
    env.BETTER_AUTH_URL = "https://si.example.workers.dev";
    expect(canonicalAppUrl("abc123-si.example.workers.dev")).toBe("https://si.example.workers.dev");
  });

  it("APP_URL wins over BETTER_AUTH_URL", () => {
    env.APP_URL = "https://si.awayday.com";
    env.BETTER_AUTH_URL = "https://si.example.workers.dev";
    expect(canonicalAppUrl(null)).toBe("https://si.awayday.com");
  });

  it("strips trailing slashes so links don't double up", () => {
    delete env.APP_URL;
    env.BETTER_AUTH_URL = "https://si.example.workers.dev/";
    expect(`${canonicalAppUrl(null)}/login`).toBe("https://si.example.workers.dev/login");
  });

  it("falls back to the request host only when nothing is configured (local dev)", () => {
    delete env.APP_URL;
    delete env.BETTER_AUTH_URL;
    expect(canonicalAppUrl("localhost:3000", "http")).toBe("http://localhost:3000");
    expect(canonicalAppUrl(null)).toBe("http://localhost:3000");
  });
});
