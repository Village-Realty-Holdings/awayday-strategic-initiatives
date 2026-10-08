// Canonical public URL for links we email out.
//
// Never derive these from the incoming request host: requests can arrive on any
// alias (e.g. a versioned preview URL), and an emailed link built from one goes
// stale.
export function canonicalAppUrl(fallbackHost?: string | null, proto = "https"): string {
  const configured = process.env.APP_URL ?? process.env.BETTER_AUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return fallbackHost ? `${proto}://${fallbackHost}` : "http://localhost:3000";
}
