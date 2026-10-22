"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DatePicker } from "@/components/date-picker";
import { InitiativeChecklist } from "@/components/initiative-checklist";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import type { CimRisk } from "@/generated/prisma/client";

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


  return (
    <form action={action} className="flex flex-col gap-5">
      {r && <input type="hidden" name="id" value={r.id} />}
      {r && <input type="hidden" name="updatedAt" value={r.updatedAt.toISOString()} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" required={isNew}>
          {r ? (
            <p className="tabular py-2 text-sm text-ink-muted">{r.code} (fixed)</p>
          ) : (
            <Input name="code" required defaultValue={nextCimCode(usedCodes)} className="tabular" />
          )}
        </Field>
        <Field label="Category" required>
          <NativeSelect name="category" defaultValue={r?.category ?? CATEGORIES[0]}>
            {r?.category && !CATEGORIES.includes(r.category) && <option value={r.category}>{r.category}</option>}
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </Field>
      </div>

      <Field label="Risk dimension (short name)" required>
        <Input name="risk" required defaultValue={r?.risk} placeholder="e.g. Brand-level NPS variance" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Owner">
          <NativeSelect name="owner" defaultValue={r?.owner ?? ""}>
            <option value="">— unassigned —</option>
            {r?.owner && !owners.includes(r.owner) && <option value={r.owner}>{r.owner}</option>}
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Size of prize">
          <Input
            name="prize"
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            placeholder="e.g. $5M EBITDA · or 'EV moat'"
          />
        </Field>
        <Field label="Prize ($M, for rollups)">
          <Input
            type="number"
            step="0.1"
            name="prizeNum"
            value={effectivePrizeNum}
            onChange={(e) => { setPrizeNum(e.target.value); setPrizeTouched(true); }}
            placeholder={derived != null ? `auto: ${derived}` : "—"}
            className="tabular"
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
          <Textarea name="currentState" rows={2} defaultValue={r?.currentState ?? ""} placeholder="Where we are now." />
        </Field>
        <Field label="Target (mitigated) state">
          <Textarea name="targetState" rows={2} defaultValue={r?.targetState ?? ""} placeholder="What 'fully mitigated' looks like." />
        </Field>
      </div>

      <div>
        <span className="text-xs font-medium text-ink-muted">Linked Strategic Initiatives</span>
        <p className="mb-2 mt-0.5 text-[11px] text-ink-faint">
          The SIs that drive this risk toward mitigation. Coverage = their average progress.
        </p>
        <InitiativeChecklist name="initiativeIds" initiatives={initiatives} defaultSelected={linkedIds} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Button asChild variant="link" className="font-normal text-ink-muted hover:text-ink hover:no-underline">
          <Link href="/risks">Cancel</Link>
        </Button>
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
  // Label's own caption styling is reset so children inherit the same text
  // as the old plain <label>; the caption span below carries the caption look.
  const Wrap = asDiv ? "div" : Label;
  return (
    <Wrap className={asDiv ? "flex flex-col gap-1.5" : "flex flex-col gap-1.5 text-base font-normal text-ink"}>
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
    <Label className="flex w-fit cursor-pointer items-center gap-2 pt-6 text-sm font-normal text-ink">
      <Checkbox name={name} defaultChecked={checked} />
      {label}
    </Label>
  );
}
