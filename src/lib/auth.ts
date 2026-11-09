import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor, admin, magicLink, jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildTrustedOrigins } from "@/lib/trusted-origins";
import { magicLinkAllowed } from "@/lib/magic-link-policy";
import { confirmLinkFor } from "@/lib/sign-in-confirm";
import { canonicalAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { buildSignInLinkEmail } from "@/lib/sign-in-email";
import { microsoftProviderFromEnv } from "@/lib/sso";
import {
  isAllowedRedirectUri,
  mcpResourceUrl,
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_REFRESH_TOKEN_TTL_SECONDS,
  needsEntraSignIn,
  oauthIssuer,
  OAUTH_CONSENT_PAGE,
  OAUTH_SCOPES,
  OAUTH_SIGN_IN_PAGE,
  signInMethodFromPath,
} from "@/lib/mcp-oauth";

// Origins allowed to call the auth endpoints (CSRF origin check): this
// deployment's configured URLs + localhost. See trusted-origins.ts.
const trustedOrigins = buildTrustedOrigins(process.env);

// Microsoft Entra ID (Azure AD) SSO. DARK until MICROSOFT_CLIENT_ID, _SECRET and
// _TENANT_ID are all present in the environment: absent creds => undefined =>
// no social provider registered, so a deployment without them is unchanged.
// Tenant-pinned (never "common"), see sso.ts. Deferred for this app at launch
// (fresh database, no Entra app registration yet); the code path stays inert.
const microsoft = microsoftProviderFromEnv(process.env);

// Exported so tests exercise the same lifetimes as the app.
export const sessionConfig = {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24, // refresh daily
  // Validate the session from a short-lived signed cookie instead of hitting the
  // DB on every request (getSession runs on essentially every page + action via
  // requireSession). maxAge is deliberately short (60s): it bounds how long a
  // role change or a revoked/banned session can lag to ~1 minute, which matters
  // here since security is a priority. App entitlement (appAccess) is read
  // separately from the DB, so per-app access stays immediate regardless.
  cookieCache: { enabled: true, maxAge: 60 },
};

// The MCP endpoint's resource identifier; access tokens are bound to it (aud).
const mcpResource = mcpResourceUrl(process.env);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins,
  // The jwt plugin's /token hands the browser a JWT for its session. Nothing
  // here uses it, and the OAuth provider issues its own tokens, so it is off.
  disabledPaths: ["/token"],
  emailAndPassword: {
    enabled: true,
    // Invite-only: no public registration. Admins create accounts.
    disableSignUp: true,
    minPasswordLength: 12,
    requireEmailVerification: false,
  },
  // Entra SSO, only when configured (see `microsoft` above). Account linking is
  // trusted for Microsoft so an existing invite-only account is matched to the
  // same person on their first SSO sign-in (by verified org email) and keeps its
  // role and app access. "email-password" stays trusted so both coexist.
  ...(microsoft
    ? {
        socialProviders: { microsoft },
        account: {
          accountLinking: {
            enabled: true,
            trustedProviders: ["microsoft", "email-password"],
          },
        },
      }
    : {}),
  // Roles (admin/user) via the admin plugin; MFA via TOTP. Enforcement of MFA
  // enrollment is handled in app middleware/guards.
  plugins: [
    // allowPasswordless: MFA enrollment asked every account to confirm a
    // password before issuing a TOTP secret. An account created by magic link
    // has no password to confirm, so it could sign in, get bounced to
    // /setup-mfa, and never get past it. Mohan Chandolu hit exactly that on the
    // 18 September call: "I got the OTP... and I think this is where we were
    // going in circles." His session was created; the screen after it was the
    // dead end.
    //
    // The option is first-party and narrow: a password is still demanded from
    // any account that HAS one, so nothing changes for password holders. For an
    // account without one, holding a live session is the proof, which is the
    // same standard the magic link already met.
    // Signing keys for OAuth access tokens (EdDSA; private key encrypted at rest
    // with BETTER_AUTH_SECRET), published at /api/auth/jwks. No JWT header on
    // get-session: browser sessions stay cookie-only.
    // The issuer is set explicitly so it is the same value /api/mcp verifies
    // against (mcp-auth.ts), rather than whatever base URL is inferred.
    jwt({ disableSettingJwtHeader: true, jwt: { issuer: oauthIssuer(process.env) } }),
    // OAuth 2.1 authorization server for the MCP endpoint (ADR 0001). Claude
    // registers itself (dynamic client registration), the person signs in with
    // Microsoft Entra and approves, and Claude gets a 15-minute access token
    // bound to /api/mcp plus a rotating refresh token. /api/mcp re-checks the
    // user's role, ban and app access on every call (mcp-auth.ts).
    mcp({
      resource: mcpResource,
      loginPage: OAUTH_SIGN_IN_PAGE,
      consentPage: OAUTH_CONSENT_PAGE,
      scopes: OAUTH_SCOPES,
      // Prisma can't store a resource without allowedScopes (see the plugin docs).
      resources: [{ identifier: mcpResource, allowedScopes: OAUTH_SCOPES, accessTokenTtl: MCP_ACCESS_TOKEN_TTL_SECONDS }],
      accessTokenExpiresIn: MCP_ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenExpiresIn: MCP_REFRESH_TOKEN_TTL_SECONDS,
      // claude.ai connectors register through RFC 7591 without credentials.
      // Open registration is safe only because authorization codes go solely
      // to Claude's own callbacks (isAllowedRedirectUri) and every grant needs
      // an Entra sign-in and explicit consent.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
      validateRedirectUri: (uri, _registered, defaultResult) => defaultResult && isAllowedRedirectUri(uri),
      // Entra only: a session made with a password or a sign-in link is sent to
      // the sign-in page, which offers Microsoft and nothing else.
      postLogin: {
        page: OAUTH_SIGN_IN_PAGE,
        shouldRedirect: async ({ session }) => needsEntraSignIn(session),
        consentReferenceId: () => undefined,
      },
      prefix: { refreshToken: "asi_rt_" },
    }),
    twoFactor({ issuer: "Awayday Strategic Initiatives", allowPasswordless: true }),
    admin(),
    // Passwordless sign-in for existing accounts. Possession of the mailbox
    // authenticates.
    magicLink({
      // Requested on demand rather than embedded in the invite, so the invite
      // email is never itself a credential. 30 minutes is long enough to walk
      // to a phone, short enough that a forwarded link is usually dead.
      expiresIn: 60 * 30,
      sendMagicLink: async ({ email, url }) => {
        const address = email.trim().toLowerCase();
        // The plugin will create an account for whatever address it is handed,
        // so delivery is limited to people we already expect to hear from.
        // Unknown addresses are dropped silently: saying "unknown address"
        // here would turn this into a way to test who works at Awayday.
        const user = await prisma.user.findFirst({
          where: { email: { equals: address, mode: "insensitive" } },
          select: { id: true },
        });
        const allowed = magicLinkAllowed({ isExistingUser: Boolean(user) });
        if (!allowed) return;
        // Not the verify URL itself: a mail scanner following it on delivery
        // spends the one-time token and takes the session. See sign-in-confirm.ts.
        const msg = buildSignInLinkEmail({ url: confirmLinkFor(url, canonicalAppUrl()) });
        await sendEmail({ to: address, subject: msg.subject, html: msg.html, text: msg.text });
      },
    }),
    // Must stay LAST. Server-side getSession (requireSession) extends the
    // session in the DB once a day and issues a fresh cookie; without this
    // plugin that Set-Cookie was dropped, so the browser cookie still died 7
    // days after sign-in however active the user was. This writes it through
    // from server actions and route handlers; page renders can't set cookies,
    // so SessionKeepalive in the shell covers people who only read.
    nextCookies(),
  ],
  hooks: {
    // Belt and braces for "Entra only": postLogin (above) keeps a non-Entra
    // session away from the consent page, and this refuses the consent call
    // itself, so a signed query lifted from an earlier step can't be replayed
    // against /oauth2/consent from a password or sign-in-link session.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/oauth2/consent") return;
      const session = await getSessionFromCtx(ctx);
      if (session && needsEntraSignIn(session.session)) {
        throw new APIError("FORBIDDEN", { message: "Sign in with Microsoft to connect Claude." });
      }
    }),
    // Connecting Claude is audited like other access grants (disconnecting is
    // audited in Settings > Connected apps).
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/oauth2/consent" || ctx.body?.accept !== true || isAPIError(ctx.context.returned)) return;
      const clientId = new URLSearchParams(typeof ctx.body?.oauth_query === "string" ? ctx.body.oauth_query : "").get("client_id");
      const session = await getSessionFromCtx(ctx);
      if (!clientId || !session) return;
      const consent = await prisma.oauthConsent.findFirst({
        where: { userId: session.user.id, clientId },
        select: { id: true, scopes: true, oauthclient: { select: { name: true } } },
      });
      if (consent) await audit(session.user.id, "CREATE", "OAuthConsent", consent.id, { after: { clientId, app: consent.oauthclient.name, scopes: consent.scopes } });
    }),
  },
  databaseHooks: {
    session: {
      create: {
        // Record how the session was signed in, so the MCP OAuth flow can tell
        // an Entra session from a password or sign-in-link one.
        before: async (session, ctx) => {
          const signInMethod = signInMethodFromPath(ctx?.path, ctx?.params as Record<string, unknown> | undefined);
          return { data: { ...session, signInMethod } };
        },
      },
    },
    user: {
      create: {
        before: async (user) => {
          // Accounts minted outside the admin flow (e.g. a first SSO sign-in)
          // get the least-privileged role. Admin-created accounts set their
          // own role and entitlements and are unaffected.
          const incoming = (user as { appAccess?: string[] }).appAccess;
          if (incoming && incoming.length) return;
          return { data: { ...user, appAccess: ["initiatives"], role: "user", emailVerified: true } };
        },
      },
    },
  },
  session: {
    ...sessionConfig,
    // Set by the session create hook above; never accepted from a request.
    additionalFields: { signInMethod: { type: "string", required: false, input: false } },
  },
  // Auth-flow failures (an OAuth callback that cannot complete, a bad state
  // cookie) come back to the login page with ?error=<code> so the person sees
  // why. The default sends them to "/?error=", which the proxy turns into a
  // plain redirect to /login and the code is lost; that read as a silent
  // sign-in loop on the first Entra attempt (Michael, 9/21).
  onAPIError: { errorURL: "/login" },
  // Cloudflare's edge sets cf-connecting-ip to the real client address (callers
  // can't spoof it), so per-IP rate limits key on the actual client.
  advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
  // Throttle auth endpoints (defense-in-depth on top of MFA + invite-only).
  // Stored in the database (RateLimit model): Workers isolates don't share
  // memory, so the default in-memory store would limit per isolate only.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 10 },
      // Each request sends mail to someone else's inbox, so this is tighter
      // than password sign-in: enough for a mistyped address and a retry.
      "/sign-in/magic-link": { window: 60, max: 5 },
      // SessionKeepalive calls this from every open tab (at most every 5
      // minutes each), and an office shares one IP, so the default 60/min
      // would start returning 429s to colleagues.
      "/get-session": { window: 60, max: 300 },
    },
  },
});
