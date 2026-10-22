"use client";

import { useState } from "react";
import { Pencil, Check, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProgressBar } from "@/components/badges";
import { parseDollars, formatDollarsInput } from "@/lib/initiatives";
import { updateProgress } from "@/app/(app)/initiatives/actions";

export function ProgressEditor({
  initiativeId,
  pct,
  actual,
  target,
  paceNote,
  kpiLine,
  editable,
}: {
  initiativeId: string;
  pct: number;
  actual: number | null;
  target: number | null;
  paceNote?: { behind: boolean; text: string } | null;
  kpiLine?: string | null;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(actual != null ? formatDollarsInput(String(actual)) : "");
  const [t, setT] = useState(target != null ? formatDollarsInput(String(target)) : "");

  const an = a.trim() === "" ? null : parseDollars(a);
  const tn = t.trim() === "" ? null : parseDollars(t);
  const preview =
    an !== null && tn !== null && tn !== 0 && Number.isFinite(an) && Number.isFinite(tn)
      ? Math.max(0, Math.round((an / tn) * 100)) // may exceed 100%
      : Math.round(pct * 100);

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar value={pct} />
        </div>
        <span className="tabular text-sm font-semibold text-ink">{Math.round(pct * 100)}%</span>
        {editable && (
          <Button
            type="button"
            variant="faint"
            size="bare"
            onClick={() => setOpen((v) => !v)}
            title="Update progress"
            aria-label="Update progress"
            className="hover:text-navy"
          >
            {open ? <X size={14} aria-hidden /> : <Pencil size={13} aria-hidden />}
          </Button>
        )}
      </div>

      {paceNote && (
        <p className={`mt-2 text-xs ${paceNote.behind ? "text-warn" : "text-ink-muted"}`}>{paceNote.text}</p>
      )}
      {kpiLine && !open && (
        <p className="mt-2 text-xs text-ink-muted">KPI: <span className="text-ink">{kpiLine}</span></p>
      )}

      {open && editable && (
        <form action={updateProgress} className="mt-3 rounded-md border border-border bg-surface-2/40 p-3">
          <input type="hidden" name="initiativeId" value={initiativeId} />
          <p className="mb-2 text-[11px] text-ink-faint">
            Enter value created and the value-to-create goal; percent is calculated (e.g. 850k of 1.5M = 57%, and it can exceed 100%).
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Label className="flex flex-col gap-1">
              <span className="text-[10px]">Value created ($)</span>
              <Input size="sm" value={a} onChange={(e) => setA(e.target.value)} onBlur={() => setA(formatDollarsInput(a))} inputMode="decimal" placeholder="e.g. 850,000" className="w-32 px-2.5" name="actual" />
            </Label>
            <span className="pb-2 text-ink-faint">/</span>
            <Label className="flex flex-col gap-1">
              <span className="text-[10px]">Value to create ($)</span>
              <Input size="sm" value={t} onChange={(e) => setT(e.target.value)} onBlur={() => setT(formatDollarsInput(t))} inputMode="decimal" placeholder="e.g. 1,500,000" className="w-32 px-2.5" name="target" />
            </Label>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-ink-muted">Preview: <span className="tabular font-semibold text-navy-deep">{preview}%</span></span>
              <SubmitButton size="sm">
                <Check size={13} aria-hidden /> Save
              </SubmitButton>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
