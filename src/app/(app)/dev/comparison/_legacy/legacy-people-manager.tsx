"use client";

// SNAPSHOT of src/components/people-manager.tsx before the shadcn Table +
// ToggleGroup + Checkbox migration, kept only for /dev/comparison. Server
// actions come from PeopleActionsProvider (mocked on the comparison page).

import { useState } from "react";
import { APPS as APP_DEFS } from "@/lib/apps";
import Link from "next/link";
import { toast } from "sonner";
import { UserPlus, KeyRound, ShieldCheck, Loader2, Check, RefreshCw, SlidersHorizontal, Pencil, UserMinus } from "lucide-react";
import type { AdminResult } from "@/app/(app)/settings/admin/actions";
import { usePeopleActions, type Person } from "@/components/people-manager";
import { ConfirmAction } from "@/components/confirm-action";
import { LegacyButton as Button } from "./legacy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";

// Every app, from the registry: a hand-maintained subset here meant eNPS and
// Unit Onboarding could not be granted at all, and made the missing access
// invisible rather than obviously absent.
const APPS: { key: string; label: string }[] = APP_DEFS.map((a) => ({
  key: a.key,
  label: a.key === "initiatives" ? "Initiatives" : a.name,
}));

const ROLES = [
  { v: "admin", label: "Admin" },
  { v: "editor", label: "Editor" },
  { v: "user", label: "Viewer" },
];

function genPassword(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  let out = "";
  for (const n of arr) out += a[n % a.length];
  return out + "aA1!";
}

export function LegacyPeopleManager({
  people,
  editable,
  isAdmin,
}: {
  people: Person[];
  editable: boolean;
  isAdmin: boolean;
}) {
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  // Results toast. The one exception is a generated temporary password, which
  // is shown once and must not vanish: that stays in a persistent banner.
  const report = (r: AdminResult) => {
    if (r.ok && r.tempPassword) {
      setBanner({ ok: true, text: r.message });
      return;
    }
    setBanner(null);
    if (r.ok) toast.success(r.message);
    else toast.error(r.error);
  };

  return (
    <div className="flex flex-col gap-4">
      {banner && (
        <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${banner.ok ? "border-ok/40 bg-ok-soft text-ink" : "border-risk/40 bg-risk-soft text-ink"}`}>
          {banner.text}
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="py-2">
            <Link href="/settings/people/roster/new">
              <UserPlus size={14} aria-hidden /> Add person
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="py-2">
            <Link href="/settings/people/roster/lists">
              <SlidersHorizontal size={14} aria-hidden /> Manage lists
            </Link>
          </Button>
          {!isAdmin && <span className="text-[11px] text-ink-faint">Login &amp; role changes require an admin.</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-medium text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-3 py-2.5 font-medium">Login &amp; role</th>
              <th className="px-3 py-2.5 font-medium">Position</th>
              <th className="px-3 py-2.5 font-medium">Department</th>
              <th className="px-3 py-2.5 font-medium">Apps</th>
              <th className="px-3 py-2.5 font-medium">MFA</th>
              <th className="px-4 py-2.5 text-right font-medium">Manage</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <PersonRow key={p.key} p={p} isAdmin={isAdmin} editable={editable} onResult={report} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PersonRow({ p, isAdmin, editable, onResult }: { p: Person; isAdmin: boolean; editable: boolean; onResult: (r: AdminResult) => void }) {
  const [granting, setGranting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const actions = usePeopleActions();

  async function run(action: (fd: FormData) => Promise<AdminResult>, fd: FormData, key: string) {
    setBusy(key);
    const r = await action(fd);
    setBusy(null);
    onResult(r);
    return r;
  }

  return (
    <>
      <tr className="border-b border-border/60 last:border-0">
        <td className="px-4 py-3">
          <div className="font-medium text-ink">{p.name}{p.isSelf && <span className="ml-1.5 text-[10px] text-ink-faint">(you)</span>}</div>
          <div className="text-xs text-ink-muted">{p.email ?? <span className="text-ink-faint">no email</span>}</div>
        </td>
        <td className="px-3 py-3">
          {p.userId ? (
            <NativeSelect
              size="xs"
              defaultValue={p.role ?? "user"}
              disabled={!isAdmin || p.isSelf || busy === "role"}
              onChange={(e) => { const fd = new FormData(); fd.set("id", p.userId!); fd.set("role", e.target.value); run(actions.adminSetRole, fd, "role"); }}
              className="disabled:opacity-50"
              title={p.isSelf ? "You can't change your own role" : !isAdmin ? "Admin only" : undefined}
            >
              {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </NativeSelect>
          ) : p.email && isAdmin ? (
            <Button onClick={() => setGranting((v) => !v)} variant="outline" size="xs" className="gap-1 text-navy-deep">
              <UserPlus size={12} aria-hidden /> Grant login
            </Button>
          ) : (
            <span className="text-xs text-ink-faint">{p.email ? "No login" : "Needs email"}</span>
          )}
        </td>
        <td className="px-3 py-3 text-xs text-ink-muted">{p.position ?? "—"}</td>
        <td className="px-3 py-3 text-xs text-ink-muted">{p.department ?? "—"}</td>
        <td className="px-3 py-3">
          {!p.userId ? (
            <span className="text-xs text-ink-faint">—</span>
          ) : p.role === "admin" ? (
            <span className="text-[11px] text-ink-faint">All (admin)</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {APPS.map((a) => {
                const on = p.appAccess.includes(a.key);
                return (
                  <button
                    key={a.key}
                    disabled={!isAdmin || busy === "apps"}
                    onClick={() => {
                      const cur = new Set(p.appAccess);
                      if (cur.has(a.key)) cur.delete(a.key); else cur.add(a.key);
                      const fd = new FormData();
                      fd.set("id", p.userId!);
                      for (const k of cur) fd.append("apps", k);
                      run(actions.adminSetAppAccess, fd, "apps");
                    }}
                    title={isAdmin ? `${on ? "Remove" : "Grant"} ${a.label}` : "Admin only"}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:cursor-default disabled:opacity-60 ${
                      on ? "border-navy bg-navy text-white" : "border-border bg-surface text-ink-faint hover:border-navy/50"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          )}
        </td>
        <td className="px-3 py-3">
          {p.userId ? (p.mfa ? <span className="inline-flex items-center gap-1 text-xs text-ok"><Check size={12} aria-hidden /> On</span> : <span className="text-xs text-ink-faint">Not set</span>) : <span className="text-xs text-ink-faint">—</span>}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {editable && (
              <Button onClick={() => setEditing((v) => !v)} title="Edit details" variant="outline" size="xs" className="gap-1">
                <Pencil size={12} aria-hidden /> Edit
              </Button>
            )}
            {p.userId && isAdmin && (
              <>
                <Button onClick={() => setResetting((v) => !v)} variant="outline" size="xs" className="gap-1" title="Reset password">
                  <KeyRound size={12} aria-hidden /> Password
                </Button>
                {p.mfa && (
                  <ConfirmAction
                    title="Reset MFA?"
                    description={`Reset MFA for ${p.email}? They'll set up a new authenticator at their next login and are signed out now.`}
                    confirmLabel="Reset MFA"
                    confirmVariant="default"
                    onConfirm={() => { const fd = new FormData(); fd.set("id", p.userId!); void run(actions.adminResetMfa, fd, "mfa"); }}
                    triggerProps={{ disabled: busy === "mfa", variant: "outline", size: "xs", className: "gap-1 disabled:opacity-50", title: "Reset MFA" }}
                  >
                    <ShieldCheck size={12} aria-hidden /> MFA
                  </ConfirmAction>
                )}
                {!p.isSelf && (
                  <ConfirmAction
                    title="Revoke login?"
                    description={`Revoke login for ${p.email}? They stay in the directory but can no longer sign in.`}
                    confirmLabel="Revoke login"
                    onConfirm={() => { const fd = new FormData(); fd.set("id", p.userId!); void run(actions.adminRemoveUser, fd, "revoke"); }}
                    triggerProps={{ disabled: busy === "revoke", variant: "destructive", size: "xs", className: "gap-1 disabled:opacity-50", title: "Revoke login", "aria-label": "Revoke login" }}
                  >
                    <UserMinus size={12} aria-hidden />
                  </ConfirmAction>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {editing && editable && (
        <tr className="border-b border-border/60 bg-surface-2/30">
          <td colSpan={7} className="px-4 py-3">
            <form action={async (fd) => { await actions.upsertPersonDetails(fd); }} className="flex flex-wrap items-end gap-2" onSubmit={() => setEditing(false)}>
              {p.rosterId && <input type="hidden" name="rosterId" value={p.rosterId} />}
              {p.email && <input type="hidden" name="email" value={p.email} />}
              <Labeled label="Name">
                <Input name="name" defaultValue={p.name} required className="w-44" />
              </Labeled>
              <Labeled label="Position">
                <Input name="position" defaultValue={p.position ?? ""} placeholder="e.g. Head of M&A" className="w-52" />
              </Labeled>
              <Labeled label="Department">
                <Input name="department" defaultValue={p.department ?? ""} placeholder="e.g. M&A" className="w-44" />
              </Labeled>
              <SubmitButton size="sm" className="py-2">
                <Check size={13} aria-hidden /> Save details
              </SubmitButton>
              <Button type="button" onClick={() => setEditing(false)} variant="outline" size="sm" className="py-2">Cancel</Button>
              {!p.email && <span className="text-[11px] text-ink-faint">Tip: add an email to enable a login later.</span>}
            </form>
          </td>
        </tr>
      )}

      {granting && p.email && isAdmin && (
        <tr className="border-b border-border/60 bg-surface-2/30">
          <td colSpan={7} className="px-4 py-3">
            <form
              action={async (fd) => {
                fd.set("email", p.email!);
                fd.set("name", p.name);
                const r = await run(actions.adminCreateUser, fd, "grant");
                if (r.ok) { setGranting(false); setPw(""); }
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-xs text-ink-muted">Grant {p.name} a login:</span>
              <NativeSelect name="role" defaultValue="editor" title="Platform role">
                {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </NativeSelect>
              <span className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
                <span className="text-[11px] font-medium text-ink-faint">Apps:</span>
                {APPS.map((a) => (
                  <Label key={a.key} className="flex items-center gap-1 font-normal">
                    <input type="checkbox" name="apps" value={a.key} defaultChecked className="accent-navy" /> {a.label}
                  </Label>
                ))}
              </span>
              <Input name="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={12} placeholder="password (blank = email them one)" className="w-56" />
              <Button type="button" onClick={() => setPw(genPassword())} variant="outline" size="bare" className="px-2 py-1.5" title="Generate" aria-label="Generate"><RefreshCw size={13} aria-hidden /></Button>
              <Button type="submit" disabled={busy === "grant"} size="sm">
                {busy === "grant" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <UserPlus size={13} aria-hidden />} Create login
              </Button>
              <span className="text-[11px] text-ink-faint">Blank password: their login details are emailed automatically. They set up MFA + change it on first login.</span>
            </form>
          </td>
        </tr>
      )}

      {resetting && p.userId && isAdmin && (
        <tr className="border-b border-border/60 bg-surface-2/30">
          <td colSpan={7} className="px-4 py-3">
            <form
              action={async (fd) => {
                fd.set("id", p.userId!);
                const r = await run(actions.adminSetPassword, fd, "pw");
                if (r.ok) { setResetting(false); setPw(""); }
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-xs text-ink-muted">New password for {p.email}:</span>
              <Input name="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={12} placeholder="min 12 chars" className="w-52" />
              <Button type="button" onClick={() => setPw(genPassword())} variant="outline" size="bare" className="px-2 py-1.5" title="Generate" aria-label="Generate"><RefreshCw size={13} aria-hidden /></Button>
              <Button type="submit" disabled={busy === "pw"} size="sm">
                {busy === "pw" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <KeyRound size={13} aria-hidden />} Set password
              </Button>
              <span className="text-[11px] text-ink-faint">Signs out their current sessions.</span>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </Label>
  );
}
