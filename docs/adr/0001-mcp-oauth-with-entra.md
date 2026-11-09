# ADR 0001: Connect Claude to /api/mcp with OAuth, signed in through Microsoft Entra

- **Status:** Accepted (engineering approval given in the 2026-11-09 working session; awaiting PR review)
- **Date:** 2026-11-09
- **Scope:** auth (engineering-owned under AGENTS.md §1): new OAuth endpoints, a schema migration, two new dependencies

## Context

`/api/mcp` was authenticated by personal API tokens (`asi_…`) sent as a request header. That worked for one person in Claude Code, but not for organizations:

- On claude.ai Team and Enterprise plans, a connector's request header is shared by everyone who uses it, so a personal token there acts as one person for the whole organization.
- People had to create, paste and rotate secrets by hand. Revoking them depended on each person remembering.

claude.ai custom connectors expect the MCP authorization spec instead. The connector registers itself with the server's authorization server (RFC 7591 dynamic client registration), each user signs in and approves, and Claude keeps a per-user token. This gives the per-user identity that tools like the Jira connector rely on.

## Decision

1. **The app is its own OAuth 2.1 authorization server,** using Better Auth's first-party `@better-auth/mcp` plugin (built on `@better-auth/oauth-provider`), version 1.7.14 to match `better-auth`, plus Better Auth's `jwt()` plugin for signing keys.
   - Microsoft Entra can't be the authorization server directly. Its v2 endpoint rejects the RFC 8707 `resource` parameter MCP clients send, and it doesn't support dynamic client registration.
   - A hand-written OAuth server was rejected: it would be a lot of security-critical code to maintain.
2. **Entra sign-in only.** The OAuth login page offers only "Sign in with Microsoft". Sessions now record how they were signed in (`session.signInMethod`). A password or sign-in-link session is sent back through Microsoft (`postLogin`), and a `before` hook refuses `/oauth2/consent` for any non-Entra session. Admin impersonation sessions don't count as Entra either.
3. **Open dynamic registration, restricted callbacks.** Anyone can register a client, because that's how claude.ai connects. Authorization codes are only ever sent to Claude's callbacks: `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`, and loopback `http://localhost|127.0.0.1|[::1]:<port>/callback` for Claude Code and Desktop. Registration is rate limited (5 per minute per IP), and PKCE (S256) is required.
4. **Tokens.**
   - Access tokens are 15-minute EdDSA JWTs bound to `<origin>/api/mcp` (the `aud` claim). Refresh tokens rotate, are stored hashed, carry the `asi_rt_` prefix, and last 30 days.
   - Scopes: `mcp:read`, plus `mcp:write` for editing. Claude is told to also request `offline_access`, since Better Auth only issues refresh tokens for that scope.
   - On the consent page people choose between "Allow editing" and "Allow read only".
5. **Per-request checks in `/api/mcp`** (`src/lib/mcp-auth.ts`):
   - The JWT is verified in-process against the app's own keys (`auth.api.getJwks()`), not by fetching `/api/auth/jwks` over HTTP, because a Cloudflare Worker can't reliably fetch its own hostname.
   - Issuer, audience, `sub`, `azp` and `exp` are required. DPoP-bound tokens are refused, since this endpoint doesn't check proofs.
   - The user's consent for that client must still exist, so disconnecting takes effect immediately. The token only gets the access that consent still allows, so re-approving as read only also downgrades older write tokens.
   - Role, ban and app access are read fresh on every request.
   - Rate limit: 120 requests per minute per user and client.
6. **Personal API tokens are removed:**
   - The endpoint and the Settings page no longer use them. The Settings page is replaced by **Settings → Connected apps** (list and disconnect).
   - The `ApiToken` table is left in place, unused, so the previous release can still be redeployed as a rollback. Dropping it is a destructive migration for a later release, once the OAuth flow is confirmed in production.
7. **Disconnecting.** Every path goes through `src/lib/mcp-connections.ts`: it deletes the consent, revokes refresh tokens, and audits who disconnected and why. The paths are:
   - the person, in Settings → Connected apps;
   - an admin, in **Admin → Connected apps**, which lists everyone's connections with "Disconnect" and "All for this person";
   - **signing out of the app**, via a `before` hook on `/sign-out`;
   - an admin resetting someone's password or MFA;
   - Better Auth's `/admin/ban-user` and `/admin/revoke-user-sessions`.

   Removing a user cascades their connections away.
8. **Discovery:**
   - Protected resource metadata at `/.well-known/oauth-protected-resource[/api/mcp]`, written in the app.
   - Authorization server and OIDC metadata at `/.well-known/{oauth-authorization-server,openid-configuration}/api/auth`, served by the plugin's helpers.
   - `/oauth/*` and `/.well-known/*` are outside the proxy cookie gate, because both are public by design.

## Consequences

- **No change to the Entra app registration.** The flow reuses the existing Microsoft social sign-in and its `/api/auth/callback/microsoft` redirect. Connecting Claude does require Entra to be enabled on the deployment.
- **Signing out disconnects Claude everywhere** for that person: signing out on one device ends every Claude connection they have, and they reconnect from Claude. A session that merely expires does not disconnect anything. Unused connections still lapse after 30 days.
- **Rollback:** the migration is additive and `ApiToken` is untouched, so the previous release can be redeployed as is, and existing API tokens work again.
- **Registered clients accumulate** (one per connector registration). The plugin has no pruning job yet. Rate limiting bounds the growth.
- **Schema:** new tables `jwks`, `oauthClient`, `oauthResource`, `oauthClientResource`, `oauthAccessToken`, `oauthRefreshToken`, `oauthConsent`, `oauthClientAssertion`. New column `session.signInMethod`. The migration is additive only.
- **New dependencies:** `@better-auth/mcp`, `@better-auth/oauth-provider`, and `@better-auth/core` pinned to 1.7.14, so npm resolves the plugins against the same core as `better-auth`.
- **The signing key** is generated on first use, stored in `jwks` with its private key encrypted by `BETTER_AUTH_SECRET`. Rotating that secret invalidates the key and every outstanding token, so people reconnect.

## Verification

- Unit tests: `src/lib/mcp-connections.test.ts` (disconnect paths), `src/lib/mcp-oauth.test.ts` (callback allowlist, sign-in method, scopes, discovery) and `src/lib/mcp-auth.test.ts` (token checks, consent revocation, ban and access, rate limit). Proxy matcher tests are extended.
- An end-to-end script was run against `next dev` **and** the local Cloudflare Workers preview (workerd). 19 of 19 checks passed both times:
  - registration
  - a non-Claude callback refused
  - no-session and password-session redirects to Microsoft sign-in
  - the consent API refusing a password session
  - the consent page, including a tampered query
  - code → token with the correct `aud`, and a refresh token
  - MCP calls with the access token
  - refresh
  - an old `asi_` token refused
  - immediate cutoff and failed refresh after disconnect
  - reconnecting, then signing out: the access token and refresh are refused, and the sign-out disconnect is audited

  The sign-out checks (24 in total) were run against `next dev`.

  The real Microsoft sign-in step could not be run headless here, so the test created Entra-marked sessions directly in the local database.
