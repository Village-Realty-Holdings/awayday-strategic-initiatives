"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { signInCallbackURL } from "@/lib/sign-in-callback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      callbackURL: signInCallbackURL(redirectTo),
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
      callbackURL: signInCallbackURL(redirectTo),
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
    router.push("/"); // no MFA yet → requireSession routes to MFA setup first
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
    router.push("/");
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
          <p className="mt-1.5 text-note text-ink-faint">Strategic OS</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          {stage === "link-sent" ? (
            <div className="flex flex-col gap-2">
              <h1 className="text-lg font-semibold text-ink">Check your email</h1>
              <p className="text-xs leading-relaxed text-ink-muted">
                If {email} can sign in, a link is on its way. Open it on any device. The link works once and expires in
                30 minutes.
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setStage("creds")}
                className="mt-2 self-start font-normal"
              >
                Use a different address
              </Button>
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={signInWithMicrosoft}
                    disabled={ssoLoading}
                    className="flex gap-2 bg-bg px-3"
                  >
                    <MicrosoftGlyph />
                    {ssoLoading ? "Redirecting…" : "Sign in with Microsoft"}
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-note uppercase tracking-wide text-ink-faint">or</span>
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
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  setUsePassword((v) => !v);
                  setError("");
                }}
                className="self-center font-normal text-ink-muted hover:text-navy"
              >
                {usePassword ? "Email me a link instead" : "Sign in with a password"}
              </Button>
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
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "type" | "onChange" | "size">) {
  return (
    <Label className="flex flex-col gap-1.5">
      {label}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="bg-bg"
        {...rest}
      />
    </Label>
  );
}

function Submit({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={loading} className="mt-1 px-3">
      {loading ? "…" : children}
    </Button>
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
