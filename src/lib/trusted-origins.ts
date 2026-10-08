// Build the auth trusted-origins list (the CSRF origin allowlist): this
// deployment's own configured URLs (BETTER_AUTH_URL, APP_URL) plus localhost for
// `next dev` (3000) and `wrangler dev` / `opennextjs-cloudflare preview` (8787).
// No wildcards: each deployment trusts only itself.
export function buildTrustedOrigins(env: Record<string, string | undefined>): string[] {
  const origins = ["http://localhost:3000", "http://localhost:8787"];
  const add = (v?: string) => {
    if (!v) return;
    origins.push((v.startsWith("http") ? v : `https://${v}`).replace(/\/+$/, ""));
  };
  add(env.BETTER_AUTH_URL);
  add(env.APP_URL);
  return [...new Set(origins)];
}
