"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
              <Button asChild className="px-3">
                <Link href="/apps">Back to app</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <h1 className="text-lg font-semibold text-ink">Change your password</h1>
                <p className="mt-1 text-xs text-ink-muted">
                  Enter your current password, then choose a new one (at least 12 characters).
                </p>
              </div>
              <Label className="flex flex-col gap-1.5">
                Current password
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                  autoComplete="current-password"
                  autoFocus
                  className="bg-bg"
                />
              </Label>
              <Label className="flex flex-col gap-1.5">
                New password
                <Input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="bg-bg"
                />
              </Label>
              <Label className="flex flex-col gap-1.5">
                Confirm new password
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="bg-bg"
                />
              </Label>
              {error && <p className="text-xs text-risk">{error}</p>}
              <div className="mt-1 flex items-center gap-3">
                <Button type="submit" disabled={loading} className="px-3">
                  {loading ? "…" : "Change password"}
                </Button>
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
