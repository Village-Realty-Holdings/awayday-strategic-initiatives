"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Only needed once the user reaches the QR step, so keep it out of the initial bundle (#36).
const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

/**
 * Enrollment has two stages for a password holder and one for everyone else.
 *
 * An account signed in by magic link has no password to confirm, and asking
 * for one anyway made enrollment impossible: sign in, get redirected here,
 * stall, repeat. So `needsPassword` decides whether the first stage exists at
 * all, and the server decides `needsPassword` from the account's real
 * providers rather than from anything the browser claims.
 */
export function SetupMfaForm({ needsPassword }: { needsPassword: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<"password" | "verify">(needsPassword ? "password" : "verify");
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // A password holder starts enrollment by submitting the password form. With
  // no password there is no form to submit, so the secret is fetched on first
  // paint instead. The ref keeps React's development double-invoke from
  // issuing two secrets, which would leave the QR showing one and the server
  // expecting the other.
  const started = useRef(needsPassword);

  async function start(pw?: string) {
    setError("");
    setLoading(true);
    const { data, error } = await authClient.twoFactor.enable(pw ? { password: pw } : {});
    setLoading(false);
    if (error || !data) {
      setError(
        error?.message ??
          (pw ? "Could not start MFA setup. Check your password." : "Could not start MFA setup."),
      );
      return false;
    }
    setTotpURI(data.totpURI);
    setBackupCodes(data.backupCodes ?? []);
    return true;
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    if (await start(password)) setStage("verify");
  }

  // Passwordless accounts land straight on the QR step, so ask for the secret
  // once, on arrival.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(e: React.FormEvent) {
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
    <main className="grid min-h-dvh place-items-center bg-bg px-6 py-10">
      <div className="w-full max-w-md">
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
          {stage === "password" ? (
            <form onSubmit={enable} className="flex flex-col gap-4">
              <div>
                <h1 className="text-lg font-semibold text-ink">Set up two-factor authentication</h1>
                <p className="mt-1 text-xs text-ink-muted">
                  MFA is required for every account. Confirm your password to begin.
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-muted">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  autoFocus
                  className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
              </label>
              {error && <p className="text-xs text-risk">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-deep disabled:opacity-60"
              >
                {loading ? "…" : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="flex flex-col gap-4">
              <div>
                <h1 className="text-lg font-semibold text-ink">Scan, then verify</h1>
                <p className="mt-1 text-xs text-ink-muted">
                  Scan with Google Authenticator, 1Password, or Authy, then enter the 6-digit code.
                </p>
              </div>
              <div className="grid min-h-[12rem] place-items-center rounded-lg border border-border bg-white p-4">
                {totpURI ? (
                  <QRCode value={totpURI} size={160} />
                ) : (
                  <span className="text-xs text-ink-faint">{error ? "" : "Preparing your code…"}</span>
                )}
              </div>
              {backupCodes.length > 0 && (
                <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                  <p className="mb-1.5 text-[11px] font-medium text-ink-muted">
                    Backup codes (save these somewhere safe):
                  </p>
                  <div className="tabular grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-ink">
                    {backupCodes.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-muted">Authentication code</span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
              </label>
              {error && <p className="text-xs text-risk">{error}</p>}
              <button
                type="submit"
                disabled={loading || !totpURI}
                className="mt-1 rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-deep disabled:opacity-60"
              >
                {loading ? "…" : "Enable MFA"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
