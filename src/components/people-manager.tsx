"use client";

import { createContext, useContext, useState } from "react";
import { APPS as APP_DEFS } from "@/lib/apps";
import Link from "next/link";
import { toast } from "sonner";
import { UserPlus, KeyRound, ShieldCheck, Loader2, Check, RefreshCw, SlidersHorizontal, Pencil, UserMinus } from "@/components/icons";
import {
  adminCreateUser,
  adminSetRole,
  adminSetPassword,
  adminResetMfa,
  adminRemoveUser,
  adminSetAppAccess,
  type AdminResult,
} from "@/app/(app)/admin/actions";
import { upsertPersonDetails } from "@/app/(app)/admin/people/roster/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

// Every server action this screen calls. Real by default; /dev/comparison
// provides mocks so the screen can be exercised without touching accounts.
const REAL_ACTIONS = {
  adminCreateUser,
  adminSetRole,
  adminSetPassword,
  adminResetMfa,
  adminRemoveUser,
  adminSetAppAccess,
  upsertPersonDetails: upsertPersonDetails as (fd: FormData) => Promise<unknown>,
};
export type PeopleActions = typeof REAL_ACTIONS;
const PeopleActionsContext = createContext<PeopleActions>(REAL_ACTIONS);
export const PeopleActionsProvider = PeopleActionsContext.Provider;
export const usePeopleActions = () => useContext(PeopleActionsContext);

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
            <Link href="/admin/people/roster/new">
              <UserPlus size={14} aria-hidden /> Add person
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="py-2">
            <Link href="/admin/people/roster/lists">
              <SlidersHorizontal size={14} aria-hidden /> Manage lists
            </Link>
          </Button>
          {!isAdmin && <span className="text-[11px] text-ink-faint">Login &amp; role changes require an admin.</span>}
        </div>
      )}

      <Table stickyHeader containerClassName="rounded-xl border border-border bg-surface" className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Person</TableHead>
            <TableHead>Login &amp; role</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Apps</TableHead>
            <TableHead>MFA</TableHead>
            <TableHead className="pr-4 text-right">Manage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.length === 0 && <TableEmpty colSpan={7}>No people yet. Add someone to start the directory.</TableEmpty>}
          {people.map((p) => (
            <PersonRow key={p.key} p={p} isAdmin={isAdmin} editable={editable} onResult={report} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PersonRow({ p, isAdmin, editable, onResult }: { p: Person; isAdmin: boolean; editable: boolean; onResult: (r: AdminResult) => void }) {
  const [granting, setGranting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Optimistic app access: pills flip at once, and revert if the save fails.
  const [apps, setApps] = useState<string[]>(p.appAccess);
  const [grantApps, setGrantApps] = useState<string[]>(APPS.map((a) => a.key));
  const actions = usePeopleActions();
  const open = editing || granting || resetting;

  async function run(action: (fd: FormData) => Promise<AdminResult>, fd: FormData, key: string) {
    setBusy(key);
    const r = await action(fd);
    setBusy(null);
    onResult(r);
    return r;
  }

  return (
    <>
      <TableRow data-state={open ? "selected" : undefined}>
        <TableCell className="py-3 pl-4">
          <div className="font-medium text-ink">{p.name}{p.isSelf && <span className="ml-1.5 text-[10px] text-ink-faint">(you)</span>}</div>
          <div className="text-xs text-ink-muted">{p.email ?? <span className="text-ink-faint">no email</span>}</div>
        </TableCell>
        <TableCell className="py-3">
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
            <Button onClick={() => setGranting((v) => !v)} aria-expanded={granting} variant="outline" size="xs" className="gap-1 text-navy-deep">
              <UserPlus size={12} aria-hidden /> Grant login
            </Button>
          ) : (
            <span className="text-xs text-ink-faint">{p.email ? "No login" : "Needs email"}</span>
          )}
        </TableCell>
        <TableCell className="py-3 text-xs text-ink-muted">{p.position ?? "—"}</TableCell>
        <TableCell className="py-3 text-xs text-ink-muted">{p.department ?? "—"}</TableCell>
        <TableCell className="py-3">
          {!p.userId ? (
            <span className="text-xs text-ink-faint">—</span>
          ) : p.role === "admin" ? (
            <span className="text-[11px] text-ink-faint">All (admin)</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <ToggleGroup
                type="multiple"
                variant="chip"
                size="xs"
                value={apps}
                disabled={!isAdmin}
                aria-label={`App access for ${p.name}`}
                onValueChange={async (next) => {
                  if (busy === "apps") return;
                  const prev = apps;
                  setApps(next);
                  const fd = new FormData();
                  fd.set("id", p.userId!);
                  for (const k of next) fd.append("apps", k);
                  const r = await run(actions.adminSetAppAccess, fd, "apps");
                  if (!r.ok) setApps(prev);
                }}
              >
                {APPS.map((a) => (
                  <ToggleGroupItem
                    key={a.key}
                    value={a.key}
                    title={isAdmin ? `${apps.includes(a.key) ? "Remove" : "Grant"} ${a.label}` : "Admin only"}
                    className="data-[state=on]:border-navy data-[state=on]:bg-navy data-[state=on]:text-white"
                  >
                    {a.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {busy === "apps" && <Loader2 size={12} className="shrink-0 animate-spin text-ink-faint" aria-label="Saving app access" />}
            </div>
          )}
        </TableCell>
        <TableCell className="py-3">
          {p.userId ? (p.mfa ? <span className="inline-flex items-center gap-1 text-xs text-ok"><Check size={12} aria-hidden /> On</span> : <span className="text-xs text-ink-faint">Not set</span>) : <span className="text-xs text-ink-faint">—</span>}
        </TableCell>
        <TableCell className="py-3 pr-4">
          <div className="flex items-center justify-end gap-1.5">
            {editable && (
              <Button onClick={() => setEditing((v) => !v)} aria-expanded={editing} title="Edit details" variant="outline" size="xs" className="gap-1">
                <Pencil size={12} aria-hidden /> Edit
              </Button>
            )}
            {p.userId && isAdmin && (
              <>
                <Button onClick={() => setResetting((v) => !v)} aria-expanded={resetting} variant="outline" size="xs" className="gap-1" title="Reset password">
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
        </TableCell>
      </TableRow>

      {editing && editable && (
        <TableRow className="bg-surface-2/40 shadow-[inset_3px_0_0_var(--color-navy)]">
          <TableCell colSpan={7} className="px-4 py-3">
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
          </TableCell>
        </TableRow>
      )}

      {granting && p.email && isAdmin && (
        <TableRow className="bg-surface-2/40 shadow-[inset_3px_0_0_var(--color-navy)]">
          <TableCell colSpan={7} className="px-4 py-3">
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
              <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5">
                <legend className="sr-only">Apps</legend>
                <span className="text-[11px] font-medium text-ink-faint" aria-hidden>
                  Apps <span className="tabular">{grantApps.length}/{APPS.length}</span>
                </span>
                {APPS.map((a) => (
                  <Label key={a.key} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 font-normal text-ink hover:bg-surface-2">
                    <Checkbox
                      name="apps"
                      value={a.key}
                      checked={grantApps.includes(a.key)}
                      onCheckedChange={(c) => setGrantApps((cur) => (c === true ? [...cur, a.key] : cur.filter((k) => k !== a.key)))}
                    />
                    {a.label}
                  </Label>
                ))}
              </fieldset>
              <Input name="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={12} placeholder="password (blank = email them one)" className="w-56" />
              <Button type="button" onClick={() => setPw(genPassword())} variant="outline" size="bare" className="px-2 py-1.5" title="Generate" aria-label="Generate"><RefreshCw size={13} aria-hidden /></Button>
              <Button type="submit" disabled={busy === "grant"} size="sm">
                {busy === "grant" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <UserPlus size={13} aria-hidden />} Create login
              </Button>
              <span className="text-[11px] text-ink-faint">Blank password: their login details are emailed automatically. They set up MFA + change it on first login.</span>
            </form>
          </TableCell>
        </TableRow>
      )}

      {resetting && p.userId && isAdmin && (
        <TableRow className="bg-surface-2/40 shadow-[inset_3px_0_0_var(--color-navy)]">
          <TableCell colSpan={7} className="px-4 py-3">
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
          </TableCell>
        </TableRow>
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
