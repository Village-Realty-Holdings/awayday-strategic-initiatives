import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isDevAuthEnabled } from "@/lib/dev-auth";

// Edge-side optimistic gate (Next 16 renamed this convention from
// `middleware` to `proxy`; same contract, same matcher): redirect to /login when no session cookie is present.
// Full session validation + MFA enforcement happens in the (app) layout (server).
// (Security headers, incl. CSP, are applied globally in next.config.ts.)
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  // Local review runs without signing in (see lib/dev-auth.ts). Gated on
  // NODE_ENV and an explicit DEV_AUTH_AS, so this is unreachable on any
  // deployment.
  // The literal member accesses matter: Next inlines process.env into the edge
  // bundle only where it can see the property statically, so reading them here
  // rather than inside the helper is what makes the bypass engage at all.
  const devAuth = isDevAuthEnabled({
    NODE_ENV: process.env.NODE_ENV,
    DEV_AUTH_AS: process.env.DEV_AUTH_AS,
  });
  if (!sessionCookie && !devAuth) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  // Expose the path to server components (layouts can't read it directly).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Protect everything except the login page, auth API, Next internals, and
  // static assets (files with an extension, e.g. the logo png, fonts, icons).
  // tests/proxy-matcher.test.ts is the regression guard.
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|map)).*)",
  ],
};
