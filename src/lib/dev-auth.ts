// Local-only sign-in bypass, so reviewing a change does not start with a
// login and a TOTP code.
//
// Michael reviews every Awayday change on a local dev server before it is
// allowed anywhere near production. Auth adds nothing to that review and a
// lot of friction to it.
//
// THIS MUST NEVER BE REACHABLE IN PRODUCTION, so it is gated two ways and
// both have to hold:
//
//   1. NODE_ENV is not "production". `next build` inlines it, and every
//      Worker bundle (opennextjs-cloudflare build, incl. local preview) is a
//      production build, so a deployment cannot enable this even by accident.
//   2. DEV_AUTH_AS names a user explicitly. Absent it, nothing happens, so
//      the bypass is opt-in per machine rather than on by default. It belongs
//      in .env.local only, never in wrangler vars or secrets.
//
// It also grants NOTHING. The email is looked up in the database and that
// user's real role, entitlements and shop scoping apply. It skips the proof
// that you are that person; it does not invent a person or their permissions.
// Naming a user who does not exist fails closed.
//
// Edge-safe on purpose: no Prisma, no Node APIs, so `src/proxy.ts` can import
// it and skip the cookie check under exactly the same conditions.

export const DEV_AUTH_ENV = "DEV_AUTH_AS";

export type Env = { NODE_ENV?: string; DEV_AUTH_AS?: string };

/**
 * The email to sign in as, or null when the bypass is off. Null is the
 * answer for every production path, and the only safe default.
 */
/**
 * Reads the variables as LITERAL member accesses. Next.js inlines
 * `process.env.FOO` into the edge bundle only when it can see the property
 * statically, so passing `process.env` wholesale leaves every value undefined
 * inside `src/proxy.ts` and the bypass silently never engages.
 */
function readEnv(): Env {
  return {
    NODE_ENV: process.env.NODE_ENV,
    DEV_AUTH_AS: process.env.DEV_AUTH_AS,
  };
}

export function devAuthEmail(env: Env = readEnv()): string | null {
  if (env.NODE_ENV === "production") return null;
  const email = env.DEV_AUTH_AS?.trim();
  return email ? email : null;
}

export function isDevAuthEnabled(env: Env = readEnv()): boolean {
  return devAuthEmail(env) !== null;
}
