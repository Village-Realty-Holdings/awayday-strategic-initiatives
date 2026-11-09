import Image from "next/image";

// The frame shared by the MCP OAuth pages: the sign-in card, without the app shell.
export function OAuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Image src="/awayday-logo.png" alt="Awayday" width={475} height={101} className="h-7 w-auto" priority />
          <p className="mt-1.5 text-note text-ink-faint">Strategic OS</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">{children}</div>
      </div>
    </main>
  );
}

export function OAuthLinkExpired() {
  return (
    <OAuthCard>
      <h1 className="text-lg font-semibold text-ink">This link has expired</h1>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        Go back to Claude and connect Strategic Initiatives again. Claude will send you back here to sign in.
      </p>
    </OAuthCard>
  );
}
