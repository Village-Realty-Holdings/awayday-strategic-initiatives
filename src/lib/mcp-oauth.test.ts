import { describe, expect, it } from "vitest";
import {
  bearerChallenge,
  isAllowedRedirectUri,
  mcpAccessFromScopes,
  mcpResourceUrl,
  needsEntraSignIn,
  oauthIssuer,
  protectedResourceMetadata,
  signInMethodFromPath,
} from "@/lib/mcp-oauth";

// MCP OAuth policy (ADR 0001): where codes may be sent, which sessions count
// as Entra, how scopes map to read/write, and what Claude is told to request.

const env = { BETTER_AUTH_URL: "https://si.example.com/" };

describe("redirect URIs", () => {
  it("accept Claude's hosted callbacks", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("https://claude.com/api/mcp/auth_callback")).toBe(true);
  });

  it("accept a loopback /callback on any port (Claude Code, Claude Desktop)", () => {
    expect(isAllowedRedirectUri("http://localhost:53682/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:8080/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://[::1]:9000/callback")).toBe(true);
  });

  it("refuse anything else", () => {
    for (const uri of [
      "https://evil.example/api/mcp/auth_callback",
      "https://claude.ai.evil.example/api/mcp/auth_callback",
      "https://claude.ai/api/mcp/auth_callback?x=1",
      "https://claude.ai/other",
      "http://claude.ai/api/mcp/auth_callback",
      "https://localhost:3000/callback",
      "http://localhost:3000/other",
      "http://user:pw@localhost:3000/callback",
      "http://10.0.0.5:3000/callback",
      "cursor://anysphere.cursor-mcp/oauth/callback",
      "not a url",
    ]) {
      expect(isAllowedRedirectUri(uri), uri).toBe(false);
    }
  });
});

describe("sign-in method", () => {
  it("is the provider for a social callback", () => {
    expect(signInMethodFromPath("/callback/:id", { id: "microsoft" })).toBe("microsoft");
    expect(signInMethodFromPath("/callback/microsoft", undefined)).toBe("microsoft");
  });

  it("is password or magic-link for the other sign-ins, and null when unknown", () => {
    expect(signInMethodFromPath("/sign-in/email", {})).toBe("password");
    expect(signInMethodFromPath("/two-factor/verify-totp", {})).toBe("password");
    expect(signInMethodFromPath("/magic-link/verify", {})).toBe("magic-link");
    expect(signInMethodFromPath("/admin/impersonate-user", {})).toBeNull();
    expect(signInMethodFromPath(undefined, undefined)).toBeNull();
  });

  it("only a Microsoft session skips the Entra step", () => {
    expect(needsEntraSignIn({ signInMethod: "microsoft" })).toBe(false);
    for (const signInMethod of ["password", "magic-link", null, undefined, "Microsoft"]) {
      expect(needsEntraSignIn({ signInMethod })).toBe(true);
    }
    expect(needsEntraSignIn({})).toBe(true);
  });
});

describe("scopes", () => {
  it("map to write, read or nothing", () => {
    expect(mcpAccessFromScopes("openid mcp:read mcp:write offline_access")).toBe("write");
    expect(mcpAccessFromScopes("mcp:write")).toBe("write");
    expect(mcpAccessFromScopes("mcp:read offline_access")).toBe("read");
    expect(mcpAccessFromScopes("openid profile")).toBeNull();
    expect(mcpAccessFromScopes(undefined)).toBeNull();
    expect(mcpAccessFromScopes(["mcp:write"])).toBeNull();
  });
});

describe("discovery", () => {
  it("binds tokens to the MCP URL and names the /api/auth issuer", () => {
    expect(mcpResourceUrl(env)).toBe("https://si.example.com/api/mcp");
    expect(oauthIssuer(env)).toBe("https://si.example.com/api/auth");
    expect(protectedResourceMetadata(env)).toMatchObject({
      resource: "https://si.example.com/api/mcp",
      authorization_servers: ["https://si.example.com/api/auth"],
      bearer_methods_supported: ["header"],
    });
  });

  it("asks Claude for both MCP scopes plus offline_access, so it gets a refresh token", () => {
    expect(protectedResourceMetadata(env).scopes_supported).toEqual(["mcp:read", "mcp:write", "offline_access"]);
    expect(bearerChallenge(env)).toBe(
      'Bearer resource_metadata="https://si.example.com/.well-known/oauth-protected-resource/api/mcp", scope="mcp:read mcp:write offline_access"',
    );
    expect(bearerChallenge(env, "invalid_token")).toContain('error="invalid_token"');
  });
});
