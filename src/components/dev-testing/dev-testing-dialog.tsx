"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  devClearUpdates,
  devLoadTestData,
  devResetAccount,
  devSetAccount,
  devSetMonthPublished,
  devSetToday,
  type DevResult,
} from "@/app/(app)/dev-testing-actions";
import { FlaskConical } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", editor: "Editor", user: "Member (user)" };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Asks for a second click before anything that can't be undone. */
function ConfirmButton({ label, disabled, onConfirm }: { label: string; disabled: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant={armed ? "destructive" : "secondary"}
      disabled={disabled}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (armed) onConfirm();
        setArmed(!armed);
      }}
    >
      {armed ? "Click again to confirm" : label}
    </Button>
  );
}

export function DevTestingDialog({
  role: currentRole,
  accountChanged,
  leads,
  months,
  today,
}: {
  role: string;
  accountChanged: boolean;
  leads: string[];
  months: { id: string; label: string; published: boolean }[];
  today: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DevResult | null>(null);
  const [role, setRole] = useState(currentRole);
  const [actAs, setActAs] = useState("");
  const [month, setMonth] = useState(months[0]?.id ?? "");
  const [day, setDay] = useState(today ?? "");

  const selectedMonth = months.find((m) => m.id === month) ?? months[0];

  function run(action: () => Promise<DevResult>) {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)} data-chrome style={{ left: "auto", right: 24, bottom: 16 }} className="no-print fixed z-40 shadow-lg">
        <FlaskConical size={14} aria-hidden /> Dev testing
        {today && <Badge variant="warn">{today}</Badge>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Dev testing</DialogTitle>
            <DialogDescription>Local only. These change your local database, never production.</DialogDescription>
          </DialogHeader>

          {result && (
            <p role="status" className={`rounded-md px-3 py-2 text-xs ${result.ok ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk"}`}>
              {result.message}
            </p>
          )}

          <div className="grid gap-4" aria-busy={pending}>
            <Section title="My account" hint="Inbox finds your SIs by name, so acting as a lead takes on that person's name.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Label className="grid gap-1 text-xs">
                  Role
                  <NativeSelect size="sm" value={role} onChange={(e) => setRole(e.target.value)}>
                    {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </NativeSelect>
                </Label>
                <Label className="grid gap-1 text-xs">
                  Act as SI lead
                  <NativeSelect size="sm" value={actAs} onChange={(e) => setActAs(e.target.value)}>
                    <option value="">My own name</option>
                    {leads.map((name) => <option key={name} value={name}>{name}</option>)}
                  </NativeSelect>
                </Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={() => run(() => devSetAccount(role, actAs))}>Apply</Button>
                {accountChanged && <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(devResetAccount)}>Back to my account</Button>}
              </div>
            </Section>

            <Section title="Test data" hint="Loading adds a mix of statuses, updates and measures in every colour, and overwrites those SIs' statuses. Clearing removes all updates and measures, not just test ones, and keeps SI statuses. Neither can be undone.">
              <div className="flex flex-wrap gap-2">
                <ConfirmButton label="Load test data" disabled={pending} onConfirm={() => run(devLoadTestData)} />
                <ConfirmButton label="Clear updates and measures" disabled={pending} onConfirm={() => run(devClearUpdates)} />
              </div>
            </Section>

            <Section title="Review month" hint="A published month locks its updates and freezes its values.">
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect size="sm" aria-label="Review month" value={selectedMonth?.id ?? ""} onChange={(e) => setMonth(e.target.value)} className="w-fit">
                  {months.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </NativeSelect>
                {selectedMonth && (
                  <>
                    <Badge variant={selectedMonth.published ? "ok" : "outline"}>{selectedMonth.published ? "Published" : "Draft"}</Badge>
                    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => devSetMonthPublished(selectedMonth.id, !selectedMonth.published))}>
                      {selectedMonth.published ? "Unpublish" : "Publish"}
                    </Button>
                  </>
                )}
              </div>
            </Section>

            <Section title="Pretend date" hint="Changes month rollover, past-due items and schedule pace on the server. Lasts until the dev server restarts. Saved timestamps stay real.">
              <div className="flex flex-wrap items-center gap-2">
                <Input size="sm" type="date" aria-label="Pretend today is" value={day} onChange={(e) => setDay(e.target.value)} className="w-fit" />
                <Button type="button" size="sm" variant="secondary" disabled={pending || !day} onClick={() => run(() => devSetToday(day))}>Set date</Button>
                {today && <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => { setDay(""); run(() => devSetToday(null)); }}>Back to today</Button>}
              </div>
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
