import { describe, it, expect, afterEach, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { auth, sessionConfig } from "@/lib/auth";

// Server-side getSession (requireSession) extends the session in the DB once a
// day and issues a fresh session cookie. Before nextCookies() was installed
// that Set-Cookie was thrown away: the DB said "valid for 7 more days" while
// the browser cookie still expired 7 days after sign-in, so active users were
// signed out weekly no matter how often they used the app.

describe("session refresh wiring", () => {
  it("installs nextCookies() last so refreshed cookies reach the browser", () => {
    const ids = (auth.options.plugins ?? []).map((p) => p.id);
    expect(ids.at(-1)).toBe("next-cookies");
  });

  it("refreshes well inside the session lifetime", () => {
    expect(sessionConfig.updateAge).toBeLessThan(sessionConfig.expiresIn);
  });

  // A server render that refreshes extends the DB session but can't write the
  // cookie, which uses up the day's refresh before SessionKeepalive gets to it.
  it("never refreshes from a server-side getSession call", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) {
          for (const call of readFileSync(path, "utf8").match(/auth\.api\.getSession\(.*/g) ?? []) {
            if (!call.includes("disableRefresh: true")) offenders.push(`${path}: ${call}`);
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe("session refresh with the app's session settings", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function testAuth() {
    const db = { user: [], session: [], account: [], verification: [] };
    return betterAuth({
      baseURL: "http://localhost:3000",
      secret: "test-secret-test-secret-test-secret-0123",
      database: memoryAdapter(db),
      emailAndPassword: { enabled: true },
      session: sessionConfig,
    });
  }

  async function signedInCookie(a: ReturnType<typeof testAuth>) {
    const res = await a.api.signUpEmail({
      body: { name: "Refresh Test", email: "refresh@example.test", password: "correct-horse-battery" },
      returnHeaders: true,
    });
    const token = res.headers
      .getSetCookie()
      .find((c) => c.startsWith("better-auth.session_token="))!
      .split(";")[0];
    return token;
  }

  it("issues a fresh 7-day session cookie once updateAge has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
    const a = testAuth();
    const cookie = await signedInCookie(a);

    // Two days later: past updateAge (1 day), so the next read refreshes.
    vi.setSystemTime(new Date("2026-10-03T09:00:00Z"));
    const res = await a.api.getSession({ headers: new Headers({ cookie }), returnHeaders: true });

    expect(res.response?.session.expiresAt.toISOString()).toBe("2026-10-10T09:00:00.000Z");
    const refreshed = res.headers.getSetCookie().find((c) => c.startsWith("better-auth.session_token="));
    expect(refreshed).toBeDefined();
    expect(refreshed).toContain(`Max-Age=${sessionConfig.expiresIn}`);
  });

  it("leaves the refresh for the route handler when a render reads with disableRefresh", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
    const a = testAuth();
    const cookie = await signedInCookie(a);
    vi.setSystemTime(new Date("2026-10-03T09:00:00Z"));

    // What requireSession does during a page render: no DB extension, so the
    // refresh is still pending...
    const render = await a.api.getSession({
      headers: new Headers({ cookie }),
      query: { disableRefresh: true },
      returnHeaders: true,
    });
    expect(render.response?.session.expiresAt.toISOString()).toBe("2026-10-08T09:00:00.000Z");

    // ...for SessionKeepalive's /get-session call, which can write the cookie.
    const keepalive = await a.api.getSession({ headers: new Headers({ cookie }), returnHeaders: true });
    expect(keepalive.response?.session.expiresAt.toISOString()).toBe("2026-10-10T09:00:00.000Z");
    expect(keepalive.headers.getSetCookie().some((c) => c.startsWith("better-auth.session_token="))).toBe(true);
  });

  it("does not rewrite the cookie before updateAge", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
    const a = testAuth();
    const cookie = await signedInCookie(a);

    vi.setSystemTime(new Date("2026-10-01T15:00:00Z"));
    const res = await a.api.getSession({ headers: new Headers({ cookie }), returnHeaders: true });

    expect(res.response?.session.expiresAt.toISOString()).toBe("2026-10-08T09:00:00.000Z");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("better-auth.session_token="))).toBe(false);
  });
});
