// The Content-Security-Policy, kept out of next.config.ts so it can be tested.
// See next.config.ts for why scripts still allow 'unsafe-inline'.

/** Where a form submission may end up, including where it redirects to. */
export const FORM_ACTION_SOURCES = ["'self'"] as const;

export function buildCsp(isProd: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action ${FORM_ACTION_SOURCES.join(" ")}`,
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
