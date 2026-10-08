"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

// Standalone, app-agnostic account page so any logged-in user (regardless of
// which module they can access) can change their own password. Sits outside the
// (app) route group so it is not gated by app entitlement; the middleware still
// requires a session. MFA stays the primary protection; this just lets people
// rotate the temporary password they were issued.
export default function AccountPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 12) {
      setError("New password must be at least 12 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Could not change your password. Check your current password.");
      return;
    }
    setDone(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Image src="/awayday-logo.png" alt="Awayday" width={475} height={101} className="h-7 w-auto" priority />
          <p className="mt-1.5 text-[11px] text-ink-faint">Strategic OS</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          {done ? (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-lg font-semibold text-ink">Password changed</h1>
                <p className="mt-1 text-xs text-ink-muted">
                  Your password has been updated and other sessions were signed out.
                </p>
              </div>
              <Link
                href="/apps"
                className="rounded-md bg-navy px-3 py-2 text-center text-sm font-medium text-white hover:bg-navy-deep"
              >
                Back to app
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <h1 className="text-lg font-semibold text-ink">Change your password</h1>
                <p className="mt-1 text-xs text-ink-muted">
                  Enter your current password, then choose a new one (at least 12 characters).
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-muted">Current password</span>
                <input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                  autoComplete="current-password"
                  autoFocus
                  className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-muted">New password</span>
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-muted">Confirm new password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
              </label>
              {error && <p className="text-xs text-risk">{error}</p>}
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-deep disabled:opacity-60"
                >
                  {loading ? "…" : "Change password"}
                </button>
                <Link href="/apps" className="text-xs text-ink-muted hover:text-ink">
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
