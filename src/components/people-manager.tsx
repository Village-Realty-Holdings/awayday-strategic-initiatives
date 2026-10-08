"use client";

import { useState } from "react";
import { APPS as APP_DEFS } from "@/lib/apps";
import Link from "next/link";
import { UserPlus, KeyRound, ShieldCheck, Loader2, Check, RefreshCw, SlidersHorizontal, Pencil, UserMinus } from "lucide-react";
import {
  adminCreateUser,
  adminSetRole,
  adminSetPassword,
  adminResetMfa,
  adminRemoveUser,
  adminSetAppAccess,
  type AdminResult,
} from "@/app/(app)/admin/actions";
import { upsertPersonDetails } from "@/app/(platform)/roster/actions";

export type Person = {
  key: string;
  rosterId: string | null;
  userId: string | null;
  name: string;
  email: string | null;
  position: string | null;
  department: string | null;
  role: string | null;
  appAccess: string[];
  mfa: boolean;
  isSelf: boolean;
};

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

export function PeopleManager({
  people,
  editable,
  isAdmin,
}: {
  people: Person[];
  editable: boolean;
  isAdmin: boolean;
}) {
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const flash = (r: AdminResult) => setBanner(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });

  return (
    <div className="flex flex-col gap-4">
      {banner && (
        <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${banner.ok ? "border-ok/40 bg-ok-soft text-ink" : "border-risk/40 bg-risk-soft text-ink"}`}>
          {banner.text}
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/roster/new" className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-navy-deep">
            <UserPlus size={14} aria-hidden /> Add person
          </Link>
          <Link href="/roster/lists" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2">
            <SlidersHorizontal size={14} aria-hidden /> Manage lists
          </Link>
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
              <PersonRow key={p.key} p={p} isAdmin={isAdmin} editable={editable} onResult={flash} />
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
            <select
              defaultValue={p.role ?? "user"}
              disabled={!isAdmin || p.isSelf || busy === "role"}
              onChange={(e) => { const fd = new FormData(); fd.set("id", p.userId!); fd.set("role", e.target.value); run(adminSetRole, fd, "role"); }}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-navy disabled:opacity-50"
              title={p.isSelf ? "You can't change your own role" : !isAdmin ? "Admin only" : undefined}
            >
              {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          ) : p.email && isAdmin ? (
            <button onClick={() => setGranting((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-navy-deep transition-colors hover:bg-surface-2">
              <UserPlus size={12} aria-hidden /> Grant login
            </button>
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
                      run(adminSetAppAccess, fd, "apps");
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
              <button onClick={() => setEditing((v) => !v)} title="Edit details" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-2">
                <Pencil size={12} aria-hidden /> Edit
              </button>
            )}
            {p.userId && isAdmin && (
              <>
                <button onClick={() => setResetting((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-2" title="Reset password">
                  <KeyRound size={12} aria-hidden /> Password
                </button>
                {p.mfa && (
                  <button
                    onClick={() => { if (confirm(`Reset MFA for ${p.email}? They'll set up a new authenticator next login.`)) { const fd = new FormData(); fd.set("id", p.userId!); run(adminResetMfa, fd, "mfa"); } }}
                    disabled={busy === "mfa"}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-2 disabled:opacity-50"
                    title="Reset MFA"
                  >
                    <ShieldCheck size={12} aria-hidden /> MFA
                  </button>
                )}
                {!p.isSelf && (
                  <button
                    onClick={() => { if (confirm(`Revoke login for ${p.email}? They stay in the directory but can no longer sign in.`)) { const fd = new FormData(); fd.set("id", p.userId!); run(adminRemoveUser, fd, "revoke"); } }}
                    disabled={busy === "revoke"}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-risk transition-colors hover:bg-risk-soft disabled:opacity-50"
                    title="Revoke login"
                  >
                    <UserMinus size={12} aria-hidden />
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {editing && editable && (
        <tr className="border-b border-border/60 bg-surface-2/30">
          <td colSpan={7} className="px-4 py-3">
            <form action={upsertPersonDetails} className="flex flex-wrap items-end gap-2" onSubmit={() => setEditing(false)}>
              {p.rosterId && <input type="hidden" name="rosterId" value={p.rosterId} />}
              {p.email && <input type="hidden" name="email" value={p.email} />}
              <Labeled label="Name">
                <input name="name" defaultValue={p.name} required className={`${input} w-44`} />
              </Labeled>
              <Labeled label="Position">
                <input name="position" defaultValue={p.position ?? ""} placeholder="e.g. Head of M&A" className={`${input} w-52`} />
              </Labeled>
              <Labeled label="Department">
                <input name="department" defaultValue={p.department ?? ""} placeholder="e.g. M&A" className={`${input} w-44`} />
              </Labeled>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-navy-deep">
                <Check size={13} aria-hidden /> Save details
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-border px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2">Cancel</button>
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
                const r = await run(adminCreateUser, fd, "grant");
                if (r.ok) { setGranting(false); setPw(""); }
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-xs text-ink-muted">Grant {p.name} a login:</span>
              <select name="role" defaultValue="editor" className={input} title="Platform role">
                {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
              <span className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
                <span className="text-[11px] font-medium text-ink-faint">Apps:</span>
                {APPS.map((a) => (
                  <label key={a.key} className="flex items-center gap-1 text-xs text-ink-muted">
                    <input type="checkbox" name="apps" value={a.key} defaultChecked className="accent-navy" /> {a.label}
                  </label>
                ))}
              </span>
              <input name="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={12} placeholder="password (blank = email them one)" className={`${input} w-56`} />
              <button type="button" onClick={() => setPw(genPassword())} className="rounded-md border border-border px-2 py-1.5 text-ink-muted transition-colors hover:bg-surface-2" title="Generate"><RefreshCw size={13} aria-hidden /></button>
              <button type="submit" disabled={busy === "grant"} className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-60">
                {busy === "grant" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <UserPlus size={13} aria-hidden />} Create login
              </button>
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
                const r = await run(adminSetPassword, fd, "pw");
                if (r.ok) { setResetting(false); setPw(""); }
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-xs text-ink-muted">New password for {p.email}:</span>
              <input name="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={12} placeholder="min 12 chars" className={`${input} w-52`} />
              <button type="button" onClick={() => setPw(genPassword())} className="rounded-md border border-border px-2 py-1.5 text-ink-muted transition-colors hover:bg-surface-2" title="Generate"><RefreshCw size={13} aria-hidden /></button>
              <button type="submit" disabled={busy === "pw"} className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-60">
                {busy === "pw" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <KeyRound size={13} aria-hidden />} Set password
              </button>
              <span className="text-[11px] text-ink-faint">Signs out their current sessions.</span>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

const input = "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-navy";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
