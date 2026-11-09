// OAuth for the MCP endpoint (/api/mcp): pure policy helpers, kept free of
// better-auth and the database so they are unit-testable. See ADR 0001.
//
// The app is its own OAuth 2.1 authorization server (Better Auth's mcp()
// plugin). Claude registers itself as a client (RFC 7591 dynamic client
// registration, which is what claude.ai custom connectors use), sends the
// person here to sign in, and gets a short-lived access token bound to
// /api/mcp. Signing in for this flow must be done with Microsoft Entra:
// a password or sign-in-link session is sent back through Microsoft first.

/** OAuth scopes for the MCP resource. "mcp:write" implies read. */
export const MCP_READ_SCOPE = "mcp:read";
export const MCP_WRITE_SCOPE = "mcp:write";
export const MCP_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE] as const;

/** Every scope the authorization server accepts. offline_access gives Claude a refresh token. */
export const OAUTH_SCOPES = ["openid", "profile", "email", "offline_access", ...MCP_SCOPES];

/**
 * What Claude is told to ask for (401 challenge and resource metadata). MCP
 * clients request exactly these, and Better Auth issues a refresh token only
 * for offline_access, so without it Claude would need a fresh sign-in every
 * time its 15-minute access token ran out.
 */
export const MCP_REQUESTED_SCOPES = [...MCP_SCOPES, "offline_access"];

/** Access tokens are JWTs checked without a database hit, so keep them short. */
export const MCP_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** How long a connection lasts without use before the person has to connect Claude again. */
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Session.signInMethod value for a Microsoft Entra sign-in. */
export const ENTRA_SIGN_IN_METHOD = "microsoft";

/** Pages the OAuth flow sends the browser to. Outside the (app) shell and the proxy gate. */
export const OAUTH_SIGN_IN_PAGE = "/oauth/sign-in";
export const OAUTH_CONSENT_PAGE = "/oauth/consent";

type Env = Record<string, string | undefined>;

function appOrigin(env: Env): string {
  const configured = env.BETTER_AUTH_URL ?? env.APP_URL;
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** The protected-resource identifier (RFC 8707): the MCP endpoint's own URL. Tokens carry it as `aud`. */
export function mcpResourceUrl(env: Env): string {
  return `${appOrigin(env)}/api/mcp`;
}

/** The authorization server's issuer: Better Auth's base URL (origin + /api/auth). */
export function oauthIssuer(env: Env): string {
  return `${appOrigin(env)}/api/auth`;
}

/** Where MCP clients find the protected resource metadata (RFC 9728, path-inserted form). */
export function protectedResourceMetadataUrl(env: Env): string {
  return `${appOrigin(env)}/.well-known/oauth-protected-resource/api/mcp`;
}

/** RFC 9728 protected resource metadata for /api/mcp. */
export function protectedResourceMetadata(env: Env) {
  return {
    resource: mcpResourceUrl(env),
    authorization_servers: [oauthIssuer(env)],
    scopes_supported: MCP_REQUESTED_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Awayday Strategic Initiatives",
  };
}

/** WWW-Authenticate for a request with no usable token, so Claude starts (or restarts) the OAuth flow. */
export function bearerChallenge(env: Env, error?: "invalid_token"): string {
  const parts = [
    `Bearer resource_metadata="${protectedResourceMetadataUrl(env)}"`,
    `scope="${MCP_REQUESTED_SCOPES.join(" ")}"`,
  ];
  if (error) parts.push(`error="${error}"`);
  return parts.join(", ");
}

// Callback URLs of the Claude apps. claude.ai and claude.com custom connectors
// use the hosted callback; Claude Code and Claude Desktop use a loopback
// listener on a random port. Registration is open (anyone can register a
// client), so this list, checked on every authorization request, is what
// keeps authorization codes from being sent anywhere else.
const HOSTED_CALLBACKS = new Set(["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True when an authorization request may send its code to this redirect URI. */
export function isAllowedRedirectUri(uri: string): boolean {
  if (HOSTED_CALLBACKS.has(uri)) return true;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  return (
    url.protocol === "http:" &&
    LOOPBACK_HOSTS.has(url.hostname) &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/callback" &&
    url.hash === ""
  );
}

/** Whether the OAuth flow must send this session back through Microsoft sign-in first. */
export function needsEntraSignIn(session: object): boolean {
  return (session as { signInMethod?: unknown }).signInMethod !== ENTRA_SIGN_IN_METHOD;
}

/**
 * How a new session was signed in, from the auth endpoint that created it.
 * Only the Microsoft social callback counts as Entra; everything else
 * (password, sign-in link, two-factor verification) is recorded as such.
 */
export function signInMethodFromPath(path: string | undefined, params: Record<string, unknown> | undefined): string | null {
  if (!path) return null;
  if (path === "/callback/:id" || path.startsWith("/callback/")) {
    const provider = typeof params?.id === "string" ? params.id : path.slice("/callback/".length);
    return provider || null;
  }
  if (path.startsWith("/sign-in/email")) return "password";
  if (path.startsWith("/magic-link")) return "magic-link";
  if (path.startsWith("/two-factor/")) return "password";
  return null;
}

/** "write" when the token was granted mcp:write, "read" when only mcp:read, null when neither. */
export function mcpAccessFromScopes(scope: unknown): "read" | "write" | null {
  const granted = new Set(typeof scope === "string" ? scope.split(" ").filter(Boolean) : []);
  if (granted.has(MCP_WRITE_SCOPE)) return "write";
  if (granted.has(MCP_READ_SCOPE)) return "read";
  return null;
}
