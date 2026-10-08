import { NextResponse } from "next/server";
import { canonicalAppUrl } from "@/lib/app-url";
import { safeVerifyTarget } from "@/lib/sign-in-confirm";

// POST only, on purpose. This is the step that spends the one-time token, and
// it is reachable only by submitting the form on the confirm page. Scanners
// fetch pages; they do not submit forms.
export async function POST(req: Request) {
  const form = await req.formData();
  const target = safeVerifyTarget(String(form.get("to") ?? ""), canonicalAppUrl());
  if (!target) return NextResponse.redirect(new URL("/login", canonicalAppUrl()), 303);
  // 303 so the browser follows with a GET, which is what the verify endpoint
  // expects, and so a refresh does not re-post a spent token.
  return NextResponse.redirect(target, 303);
}
