"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ ssoEnabled = false, initialError = "" }: { ssoEnabled?: boolean; initialError?: string }) {
  const router = useRouter();
  const [ssoLoading, setSsoLoading] = useState(false);
  const [stage, setStage] = useState<"creds" | "twofa" | "link-sent">("creds");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  // Passwordless sign-in (Michael 9/11). Review participants have no password
  // and mostly no account; the link creates one on first use. Answers the same
  // way whether or not the address is known, so this cannot be used to find out
  // who works here.
  const [usePassword, setUsePassword] = useState(false);

  async function signInWithMicrosoft() {
    setError("");
    setSsoLoading(true);
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirect");
    // Redirects to Microsoft; better-auth returns to callbackURL after the handshake.
    const { error } = await authClient.signIn.social({
      provider: "microsoft",
      callbackURL: redirectTo && redirectTo.startsWith("/") ? redirectTo : "/apps",
    });
    if (error) {
      setSsoLoading(false);
      setError(error.message ?? "Microsoft sign-in failed.");
    }
  }

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirect");
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: redirectTo && redirectTo.startsWith("/") ? redirectTo : "/talent/home",
    });
    setLoading(false);
    if (error) {
      setError("Could not send the link just now. Try again in a moment.");
      return;
    }
    setStage("link-sent");
  }

  async function submitCreds(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Sign-in failed.");
      return;
    }
    if ((data as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
      setStage("twofa");
      return;
    }
    router.push("/apps"); // no MFA yet → app layout routes to MFA setup, then the launcher
    router.refresh();
  }

  async function submitTwoFa(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setLoading(false);
    if (error) {
      setError("Invalid code. Try again.");
      return;
    }
    router.push("/apps");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Image
            src="/awayday-logo.png"
            alt="Awayday"
            width={475}
            height={101}
            className="h-7 w-auto"
            priority
          />
          <p className="mt-1.5 text-[11px] text-ink-faint">Strategic OS</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          {stage === "link-sent" ? (
            <div className="flex flex-col gap-2">
              <h1 className="text-lg font-semibold text-ink">Check your email</h1>
              <p className="text-xs leading-relaxed text-ink-muted">
                If {email} can sign in, a link is on its way. Open it on any device. The link works once and expires in
                30 minutes.
              </p>
              <button
                type="button"
                onClick={() => setStage("creds")}
                className="mt-2 self-start text-xs text-navy hover:underline"
              >
                Use a different address
              </button>
            </div>
          ) : stage === "creds" ? (
            <form onSubmit={usePassword ? submitCreds : submitLink} className="flex flex-col gap-4">
              <div>
                <h1 className="text-lg font-semibold text-ink">Sign in</h1>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {ssoEnabled
                    ? "Awayday staff sign in with Microsoft."
                    : usePassword
                      ? "For Awayday leadership. Access is by invitation."
                      : "We email you a link. No password needed."}
                </p>
              </div>
              {ssoEnabled && (
                <>
                  <button
                    type="button"
                    onClick={signInWithMicrosoft}
                    disabled={ssoLoading}
                    className="flex items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
                  >
                    <MicrosoftGlyph />
                    {ssoLoading ? "Redirecting…" : "Sign in with Microsoft"}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[11px] uppercase tracking-wide text-ink-faint">or</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}
              <Field label="Email" type="email" value={email} onChange={setEmail} autoFocus autoComplete="username" />
              {usePassword && (
                <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
              )}
              {error && <p className="text-xs text-risk">{error}</p>}
              <Submit loading={loading}>{usePassword ? "Sign in" : "Email me a sign-in link"}</Submit>
              <button
                type="button"
                onClick={() => {
                  setUsePassword((v) => !v);
                  setError("");
                }}
                className="self-center text-xs text-ink-muted hover:text-navy hover:underline"
              >
                {usePassword ? "Email me a link instead" : "Sign in with a password"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitTwoFa} className="flex flex-col gap-4">
              <div>
                <h1 className="text-lg font-semibold text-ink">Two-factor code</h1>
                <p className="mt-0.5 text-xs text-ink-muted">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <Field
                label="Authentication code"
                type="text"
                value={code}
                onChange={setCode}
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
              />
              {error && <p className="text-xs text-risk">{error}</p>}
              <Submit loading={loading}>Verify</Submit>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  ...rest
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "type" | "onChange">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-navy"
        {...rest}
      />
    </label>
  );
}

function Submit({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-1 rounded-md bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-60"
    >
      {loading ? "…" : children}
    </button>
  );
}

function MicrosoftGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0" y="0" width="7" height="7" fill="#F25022" />
      <rect x="9" y="0" width="7" height="7" fill="#7FBA00" />
      <rect x="0" y="9" width="7" height="7" fill="#00A4EF" />
      <rect x="9" y="9" width="7" height="7" fill="#FFB900" />
    </svg>
  );
}
