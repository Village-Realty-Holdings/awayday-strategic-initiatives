"use client";

import { useState } from "react";
import { Check } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProgressBar } from "@/components/badges";
import { parseDollars, formatDollarsInput } from "@/lib/initiatives";
import { updateProgress } from "@/app/(app)/initiatives/actions";

/** Read-only progress readout: big %, bar, pace note and KPI line. */
export function ProgressSummary({
  pct,
  paceNote,
  kpiLine,
}: {
  pct: number;
  paceNote?: { behind: boolean; text: string } | null;
  kpiLine?: string | null;
}) {
  return (
    <div>
      <span className="tabular text-2xl font-semibold text-ink">{Math.round(pct * 100)}%</span>
      <div className="mt-2">
        <ProgressBar value={pct} hideLabel />
      </div>
      {paceNote && (
        <p className={`mt-2 text-xs ${paceNote.behind ? "text-warn" : "text-ink-muted"}`}>{paceNote.text}</p>
      )}
      {kpiLine && <p className="mt-2 text-xs text-ink-muted">KPI: <span className="text-ink">{kpiLine}</span></p>}
    </div>
  );
}

/** Value created / value to create form; the percent is calculated from the two. */
export function ProgressForm({
  initiativeId,
  pct,
  actual,
  target,
}: {
  initiativeId: string;
  pct: number;
  actual: number | null;
  target: number | null;
}) {
  const [a, setA] = useState(actual != null ? formatDollarsInput(String(actual)) : "");
  const [t, setT] = useState(target != null ? formatDollarsInput(String(target)) : "");

  const an = a.trim() === "" ? null : parseDollars(a);
  const tn = t.trim() === "" ? null : parseDollars(t);
  const preview =
    an !== null && tn !== null && tn !== 0 && Number.isFinite(an) && Number.isFinite(tn)
      ? Math.max(0, Math.round((an / tn) * 100)) // may exceed 100%
      : Math.round(pct * 100);

  return (
    <form action={updateProgress} className="grid gap-2">
      <input type="hidden" name="initiativeId" value={initiativeId} />
      <p className="text-[11px] text-ink-faint">
        Enter value created and the value-to-create goal; percent is calculated (e.g. 850k of 1.5M = 57%, and it can exceed 100%).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Label className="grid gap-1 text-xs font-medium text-ink-muted">
          Value created ($)
          <Input size="sm" value={a} onChange={(e) => setA(e.target.value)} onBlur={() => setA(formatDollarsInput(a))} inputMode="decimal" placeholder="e.g. 850,000" className="tabular w-40" name="actual" />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-ink-muted">
          Value to create ($)
          <Input size="sm" value={t} onChange={(e) => setT(e.target.value)} onBlur={() => setT(formatDollarsInput(t))} inputMode="decimal" placeholder="e.g. 1,500,000" className="tabular w-40" name="target" />
        </Label>
        <span className="pb-2 text-xs text-ink-muted">Preview: <span className="tabular font-semibold text-navy-deep">{preview}%</span></span>
        <SubmitButton variant="secondary" size="sm" className="ml-auto">
          <Check size={13} aria-hidden /> Save progress
        </SubmitButton>
      </div>
    </form>
  );
}
