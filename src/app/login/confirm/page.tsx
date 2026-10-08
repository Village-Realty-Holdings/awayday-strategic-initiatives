import { canonicalAppUrl } from "@/lib/app-url";
import { safeVerifyTarget } from "@/lib/sign-in-confirm";

export const metadata = { title: "Sign in | Awayday" };

// The page a sign-in link now lands on. It must NEVER navigate on its own: no
// redirect, no meta refresh, no onload script. A mail scanner will follow any
// of those, and following them is what spent the token in the first place.
// Pressing the button is the only thing that signs anyone in.
export default async function ConfirmSignIn({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const target = safeVerifyTarget(to, canonicalAppUrl());

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-ink">Finish signing in</h1>
      {target ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            One more tap. Your organisation&apos;s email security opens links before you do, so this last step waits
            for a person.
          </p>
          <form method="POST" action="/login/confirm/go" className="mt-5">
            <input type="hidden" name="to" value={target} />
            <button
              type="submit"
              className="w-full rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-deep"
            >
              Sign me in
            </button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            The link is good for 30 minutes and works once. If it has expired, request a new one from the sign-in page.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            This sign-in link is not one we can use. It may have been altered in transit, or it may have expired.
          </p>
          <a
            href="/login"
            className="mt-5 inline-block rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-2"
          >
            Request a new link
          </a>
        </>
      )}
    </main>
  );
}
