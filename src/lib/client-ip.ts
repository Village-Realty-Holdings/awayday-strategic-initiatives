// Best-effort client IP for rate limiting. On Cloudflare, `cf-connecting-ip` is
// set by the edge to the real client IP and cannot be spoofed by the caller.
// `x-real-ip` / the plain `x-forwarded-for` first hop are client-influenced
// (anyone can send them), so they're only a fallback for local dev.
export function clientIp(h: { get(name: string): string | null }): string {
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim() || "unknown";
  const real = h.get("x-real-ip");
  if (real) return real.trim() || "unknown";
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "unknown";
  return "unknown";
}
