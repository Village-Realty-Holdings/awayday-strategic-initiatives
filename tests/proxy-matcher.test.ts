import { describe, it, expect } from "vitest";
import { config } from "@/proxy";

// The edge gate redirects to /login when there is no session cookie. Only the
// sign-in surface, the auth API and static assets may bypass it.
const matches = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe("proxy matcher", () => {
  it("gates app pages and app API routes", () => {
    for (const p of ["/", "/initiatives", "/initiatives/abc/edit", "/risks", "/admin", "/people", "/api/attachments/abc"]) {
      expect(matches(p)).toBe(true);
    }
  });

  it("lets the sign-in surface and auth API through", () => {
    for (const p of ["/login", "/login/confirm", "/api/auth/sign-in/email", "/api/auth/magic-link/verify"]) {
      expect(matches(p)).toBe(false);
    }
  });

  it("lets static assets through", () => {
    for (const p of ["/awayday-logo.png", "/board-goals.jpg", "/favicon.ico", "/_next/static/chunks/a.js"]) {
      expect(matches(p)).toBe(false);
    }
  });
});
