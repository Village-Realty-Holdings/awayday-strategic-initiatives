import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { buildCsp } from "./src/lib/csp";

// Baseline security headers applied to every route.
const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy. A per-request nonce + 'strict-dynamic' policy was
// tried on the platform, but Next 16 does not propagate the nonce to its own
// framework scripts in production builds, which blocks hydration. Until that is
// fixed upstream scripts keep 'unsafe-inline'. The residual risk is low: the app
// is auth-gated, renders no user-supplied HTML (React escapes all text), and
// makes its model calls server-side. 'unsafe-eval' is dropped in production.
const csp = buildCsp(isProd);

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Only local static images (logo, board slides) go through next/image; serve
  // them as-is rather than wiring up a Cloudflare Images binding.
  images: { unoptimized: true },
  // pg picks its socket by export condition: Node gets pg-cloudflare's empty
  // stub, workerd gets the real CloudflareSocket. Next's tracing follows the
  // Node condition, so ship the whole package for the Worker bundle.
  outputFileTracingIncludes: { "/**": ["./node_modules/pg-cloudflare/**/*"] },
  // @opennextjs/cloudflare loads wrangler through a computed import() on its
  // dev-only path. Turbopack can't resolve it and traces all of node_modules,
  // which drags CLI/dev tooling (and their .wasm files) into the Worker upload
  // past the 64 MiB limit. None of it is imported at runtime.
  outputFileTracingExcludes: {
    "/**": [
      "./node_modules/{wrangler,miniflare,workerd,prisma,cloudflare,effect,tsx,typescript,vitest,esbuild,rolldown,sharp,tailwindcss,lightningcss}/**/*",
      "./node_modules/{@cloudflare/workerd-*,@electric-sql,@prisma/dev,@prisma/studio-core,@prisma/engines,@prisma/fetch-engine,@prisma/streams-local,@neon,@vitest,@esbuild,@rolldown,@img,@tailwindcss,@ast-grep,@next/swc-*}/**/*",
      "./node_modules/{eslint,eslint-*,@eslint,@typescript-eslint,typescript-eslint}/**/*",
    ],
  },
  // Attachment uploads go through a server action (3 MB file cap + form fields).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Old locations kept so bookmarks and links in sent emails still resolve:
  // the V2 preview (now the app at /), the Settings pages that moved to the
  // admin-only Admin section, and earlier renames.
  async redirects() {
    return [
      { source: "/account", destination: "/settings/password", permanent: false },
      { source: "/people", destination: "/admin/people", permanent: false },
      { source: "/roster", destination: "/admin/people", permanent: false },
      { source: "/roster/:path*", destination: "/admin/people/roster/:path*", permanent: false },
      { source: "/settings/people", destination: "/admin/people", permanent: false },
      { source: "/settings/people/:path*", destination: "/admin/people/:path*", permanent: false },
      { source: "/settings/archive", destination: "/admin/archive", permanent: false },
      { source: "/legacy", destination: "/admin/archive", permanent: false },
      { source: "/settings/admin/plans", destination: "/admin/plans", permanent: false },
      { source: "/settings/admin/ai-telemetry", destination: "/admin/ai-telemetry", permanent: false },
      { source: "/settings/admin", destination: "/admin", permanent: false },
      { source: "/settings/admin/:path*", destination: "/admin", permanent: false },
      { source: "/groups", destination: "/admin/groups", permanent: false },
      { source: "/initiatives", destination: "/admin/initiatives", permanent: false },
      { source: "/initiatives/new", destination: "/admin/initiatives/new", permanent: false },
      { source: "/initiatives/:id/edit", destination: "/admin/initiatives/:id/edit", permanent: false },
      { source: "/sources", destination: "/admin/data-sources", permanent: false },
      { source: "/v2/data", destination: "/admin/data-sources", permanent: false },
      { source: "/v2/review/:period/edit", destination: "/review/:period", permanent: false },
      { source: "/v2/review", destination: "/", permanent: false },
      { source: "/v2/si/:code", destination: "/", permanent: false },
      { source: "/v2/shop-plans", destination: "/", permanent: false },
      { source: "/v2", destination: "/", permanent: false },
      { source: "/v2/:path*", destination: "/:path*", permanent: false },
      { source: "/narrative", destination: "/reporting", permanent: false },
      { source: "/gantt", destination: "/reporting?view=gantt", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// Makes getCloudflareContext() (bindings: HYPERDRIVE, ATTACHMENTS) work in
// `next dev`. Dev only: it needs a local Hyperdrive connection string, which
// builds (incl. Workers Builds) don't have and don't need.
if (process.env.NODE_ENV === "development") initOpenNextCloudflareForDev();
