"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// App-agnostic account page so any logged-in user (regardless of which module
// they can access) can change their own password. Lives in the (platform) group
// so it gets the shared shell without the app-entitlement gate. MFA stays the primary protection; this just lets people
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
    <div className="flex w-full max-w-lg flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Change password</h1>
        <p className="mt-1 text-xs text-ink-muted">
          Enter your current password, then choose a new one (at least 12 characters).
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6">
        {done ? (
          <p role="status" className="text-sm text-ink">
            Your password has been updated and other sessions were signed out.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
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
            <div className="mt-1">
              <Button type="submit" disabled={loading} className="px-3">
                {loading ? "…" : "Change password"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
