"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DatePicker } from "@/components/date-picker";
import type { CimRisk } from "@/generated/prisma/client";

const input =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-navy";

const CATEGORIES = [
  "Business risks",
  "M&A risks",
  "Scalability",
  "Market risks",
  "Competitive risks",
  "Margin risk",
  "AI risk",
  "Other",
];

const dateValue = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

function nextCimCode(used: string[]): string {
  let max = 0;
  for (const c of used) {
    const m = /CIM-(\d+)/i.exec(c);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `CIM-${String(max + 1).padStart(2, "0")}`;
}

function parsePrizeNum(prize: string): number | null {
  const nums = (prize.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  return Math.round((nums[0] + nums[1]) / 2);
}

export function CimForm({
  action,
  risk,
  submitLabel,
  initiatives = [],
  linkedIds = [],
  usedCodes = [],
  owners = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  risk?: CimRisk;
  submitLabel: string;
  initiatives?: { id: string; code: string; name: string }[];
  linkedIds?: string[];
  usedCodes?: string[];
  owners?: string[];
}) {
  const r = risk;
  const isNew = !r;
  const [prize, setPrize] = useState(r?.prize ?? "");
  const [prizeNum, setPrizeNum] = useState<string>(r?.prizeNum != null ? String(r.prizeNum) : "");
  const [prizeTouched, setPrizeTouched] = useState(false);

  const derived = useMemo(() => parsePrizeNum(prize), [prize]);
  const effectivePrizeNum = prizeTouched || prizeNum !== "" ? prizeNum : derived != null ? String(derived) : "";

  const linkedSet = useMemo(() => new Set(linkedIds), [linkedIds]);

  return (
    <form action={action} className="flex flex-col gap-5">
      {r && <input type="hidden" name="id" value={r.id} />}
      {r && <input type="hidden" name="updatedAt" value={r.updatedAt.toISOString()} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" required={isNew}>
          {r ? (
            <p className="tabular py-2 text-sm text-ink-muted">{r.code} (fixed)</p>
          ) : (
            <input name="code" required defaultValue={nextCimCode(usedCodes)} className={`${input} tabular`} />
          )}
        </Field>
        <Field label="Category" required>
          <select name="category" defaultValue={r?.category ?? CATEGORIES[0]} className={input}>
            {r?.category && !CATEGORIES.includes(r.category) && <option value={r.category}>{r.category}</option>}
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Risk dimension (short name)" required>
        <input name="risk" required defaultValue={r?.risk} placeholder="e.g. Brand-level NPS variance" className={input} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Owner">
          <select name="owner" defaultValue={r?.owner ?? ""} className={input}>
            <option value="">— unassigned —</option>
            {r?.owner && !owners.includes(r.owner) && <option value={r.owner}>{r.owner}</option>}
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Size of prize">
          <input
            name="prize"
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            placeholder="e.g. $5M EBITDA · or 'EV moat'"
            className={input}
          />
        </Field>
        <Field label="Prize ($M, for rollups)">
          <input
            type="number"
            step="0.1"
            name="prizeNum"
            value={effectivePrizeNum}
            onChange={(e) => { setPrizeNum(e.target.value); setPrizeTouched(true); }}
            placeholder={derived != null ? `auto: ${derived}` : "—"}
            className={`${input} tabular`}
          />
        </Field>
        <Field label="Target date" asDiv>
          <DatePicker
            name="targetDate"
            label="Target date"
            defaultValue={dateValue(r?.targetDate ?? null)}
            clearable
            align="end"
          />
        </Field>
        <CheckField label="Focus" name="focus" checked={r?.focus ?? false} />
        <CheckField label="Critical" name="critical" checked={r?.critical ?? false} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current state (today)">
          <textarea name="currentState" rows={2} defaultValue={r?.currentState ?? ""} placeholder="Where we are now." className={input} />
        </Field>
        <Field label="Target (mitigated) state">
          <textarea name="targetState" rows={2} defaultValue={r?.targetState ?? ""} placeholder="What 'fully mitigated' looks like." className={input} />
        </Field>
      </div>

      <div>
        <span className="text-xs font-medium text-ink-muted">Linked Strategic Initiatives</span>
        <p className="mb-2 mt-0.5 text-[11px] text-ink-faint">
          The SIs that drive this risk toward mitigation. Coverage = their average progress.
        </p>
        <div className="grid max-h-56 grid-cols-1 gap-x-4 gap-y-1.5 overflow-y-auto rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3">
          {initiatives.length === 0 && <p className="text-xs text-ink-faint">No initiatives yet.</p>}
          {initiatives.map((i) => (
            <label key={i.id} className="flex items-center gap-2 text-xs text-ink">
              <input
                type="checkbox"
                name="initiativeIds"
                value={i.id}
                defaultChecked={linkedSet.has(i.id)}
                className="h-3.5 w-3.5 shrink-0 rounded border-border accent-navy"
              />
              <span className="truncate" title={`${i.code} · ${i.name}`}>
                <span className="tabular text-ink-faint">{i.code}</span> {i.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep">
          {submitLabel}
        </button>
        <Link href="/risks" className="text-sm text-ink-muted transition-colors hover:text-ink">Cancel</Link>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
  asDiv,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  /** Render a div instead of a label — for controls that are buttons (DatePicker),
   *  where a wrapping label would forward the click and double-activate them. */
  asDiv?: boolean;
}) {
  const Wrap = asDiv ? "div" : "label";
  return (
    <Wrap className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-risk"> *</span>}
      </span>
      {children}
    </Wrap>
  );
}

function CheckField({ label, name, checked }: { label: string; name: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 pt-6">
      <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 rounded border-border accent-navy" />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}
