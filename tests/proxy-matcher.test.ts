import { describe, it, expect } from "vitest";
import { config } from "@/proxy";

// The edge gate redirects to /login when there is no session cookie. Only the
// sign-in surface, the auth API and static assets may bypass it.
const matches = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe("proxy matcher", () => {
  it("gates app pages and app API routes", () => {
    for (const p of ["/", "/admin/initiatives", "/initiatives/abc/edit", "/risks", "/admin", "/admin/people", "/reporting", "/api/attachments/abc"]) {
      expect(matches(p)).toBe(true);
    }
  });

  it("lets the sign-in surface and auth API through", () => {
    for (const p of ["/login", "/login/confirm", "/api/auth/sign-in/email", "/api/auth/magic-link/verify"]) {
      expect(matches(p)).toBe(false);
    }
  });

  it("lets the MCP endpoint through: it checks its own bearer token", () => {
    expect(matches("/api/mcp")).toBe(false);
  });

  it("lets the MCP OAuth pages and discovery documents through: they are public by design", () => {
    for (const p of [
      "/oauth/sign-in",
      "/oauth/consent",
      "/.well-known/oauth-protected-resource/api/mcp",
      "/.well-known/oauth-authorization-server/api/auth",
      "/.well-known/openid-configuration/api/auth",
    ]) {
      expect(matches(p)).toBe(false);
    }
    // Only the /oauth/ folder, not anything that merely starts with "oauth".
    expect(matches("/oauthish")).toBe(true);
  });

  it("lets static assets through", () => {
    for (const p of ["/awayday-logo.png", "/board-goals.jpg", "/favicon.ico", "/_next/static/chunks/a.js"]) {
      expect(matches(p)).toBe(false);
    }
  });
});
