"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Check, TriangleAlert } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Initiative } from "@/generated/prisma/client";
import {
  QUADRANT_META,
  quadrantFor,
  valueFromDollars,
  effortToLift,
  liftToEffort,
  EFFORT_OPTS,
  formatMoney,
  formatDollarsInput,
  parseDollars,
  parseTeam,
  serializeTeam,
  STATUS_META,
  type Effort,
} from "@/lib/initiatives";
import type { InitiativeStatus } from "@/generated/prisma/client";
import { draftFromName } from "@/app/(app)/ai-actions";

const STATUSES: InitiativeStatus[] = ["NOT_STARTED", "PLANNING", "IN_PROGRESS", "AT_RISK", "DONE"];

// CIM driver → ID prefix (source: Tracker). Drives auto-generated codes.
const CIM_TO_PREFIX: Record<string, string> = {
  "M&A": "M&A",
  "Grow new units": "GRW",
  "Owner retention": "RET",
  "Margin expansion": "MRG",
  "TrevPAR expansion": "TRV",
  "Key Enablers — Talent": "TLT",
  "Key Enablers — Technology": "TEC",
};
const CIM_DRIVERS = Object.keys(CIM_TO_PREFIX);

// KPIs relevant to each CIM driver ("Metric → target"). Picking the driver
// filters the KPI list (Jakob: "too many KPIs … auto-map to the CIM driver").
const CIM_KPIS: Record<string, string[]> = {
  "M&A": [
    "Acquired EBITDA → $27.5M",
    "Margin of Safety → 25%",
    "2025 Cohort EBITDA @ Close → 120%",
    "Avg. days from LOI to close → 75 days",
    "Internally-sourced deals (% of total) → 60%",
    "Year-1 post-close EBITDA growth → 15%+",
  ],
  "Grow new units": [
    "Gross Adds → 25%",
    "Tuck-in units closed (annualized) → 300 units",
    "Units per BD rep per quarter → +25%",
    "% sales hires above bar → 85%",
    "MQL-to-signed-owner conversion → +30%",
    "REA-sourced units (% of new) → 20%",
  ],
  "Owner retention": [
    "Owner Churn (TTM) → <11%",
    "Owner portal weekly active % → 70%",
  ],
  "Margin expansion": [
    "NOI Margin Impr vs PY (Excl OTA) → +1.0%",
    "NOI $ Growth vs PY (Base Bus) → +12.5%",
    "PI bps (Base Business) → 50 bps",
  ],
  "TrevPAR expansion": [
    "TrevPAR YoY → +3.3% & > market",
    "Guest CSAT (company avg) → ≥4.65",
  ],
  "Key Enablers — Talent": [
    "ENPS (company-wide) → +30 by year-end",
    "Roles with learning path live → 100%",
    "% sales hires above bar → 85%",
  ],
  "Key Enablers — Technology": [
    "Brands on shared reporting stack → 100%",
    "Functions with AI in production → ≥6",
    "Avg. guest first-response time → <10 min",
    "Owner portal weekly active % → 70%",
  ],
};

const dateValue = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// Parse a money-ish string ("$2.5M", "400k", "750000") into a number.
function nextCode(prefix: string, used: string[]): string {
  let n = 1;
  const set = new Set(used.map((c) => c.toUpperCase()));
  const fmt = (k: number) => `${prefix}-${String(k).padStart(2, "0")}`;
  while (set.has(fmt(n).toUpperCase())) n++;
  return fmt(n);
}

export function InitiativeForm({
  action,
  initiative,
  submitLabel,
  cancelHref,
  owners = [],
  usedCodes = [],
  problemError = false,
  cimItems = [],
  cimKpis = {},
  areas = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  initiative?: Initiative;
  submitLabel: string;
  cancelHref: string;
  owners?: string[];
  usedCodes?: string[];
  problemError?: boolean;
  cimItems?: { code: string; label: string }[];
  cimKpis?: Record<string, string[]>;
  areas?: { id: string; code: string; name: string; kind: string }[];
}) {
  const i = initiative;
  const isNew = !i;

  // CIM + auto-code (new only)
  const initialCim = i?.cimDriver ?? CIM_DRIVERS[0];
  const [cim, setCim] = useState(initialCim);
  const [cimItem, setCimItem] = useState(i?.cimItemCode ?? "");
  const [code, setCode] = useState(() => (isNew ? nextCode(CIM_TO_PREFIX[CIM_DRIVERS[0]] ?? "SI", usedCodes) : i!.code));
  const [codeTouched, setCodeTouched] = useState(false);

  // Working team: People multi-select (Jakob). Stored as a comma list of names.
  const initialTeam = parseTeam(i?.supports);
  const [team, setTeam] = useState<string[]>(initialTeam);

  // Simplified scoring: Targeted Value ($) drives the Value score; Effort drives Lift.
  const [targetedRaw, setTargetedRaw] = useState(i?.progressTarget != null ? formatDollarsInput(String(i.progressTarget)) : "");
  const [realizedRaw, setRealizedRaw] = useState(i?.progressActual != null ? formatDollarsInput(String(i.progressActual)) : "");
  const [effort, setEffort] = useState<Effort>(i ? liftToEffort(i.lift) : "M");
  // Value vs non-value (enabler/milestone). Non-value hides the dollar fields.
  const [valueType, setValueType] = useState(i?.valueType ?? "VALUE");
  const isValue = valueType === "VALUE";

  const targeted = targetedRaw.trim() ? parseDollars(targetedRaw) : null;
  const realized = realizedRaw.trim() ? parseDollars(realizedRaw) : null;
  // % complete is purely value realized ÷ targeted (can exceed 100%). No manual entry.
  const pctCalc = targeted && targeted > 0 && realized != null ? realized / targeted : null;
  const value = valueFromDollars(targeted);
  const lift = effortToLift(effort);
  const quadrant = quadrantFor(value, lift);

  // KPI helper -> fills metric/target
  const [metric, setMetric] = useState(i?.quantMetric ?? "");
  const [target, setTarget] = useState(i?.quantTarget ?? "");

  // Charter fields (controlled so the Claude draft can fill them)
  const [name2, setName] = useState(i?.name ?? "");
  const [problem, setProblem] = useState(i?.problem ?? "");
  const [objective, setObjective] = useState(i?.valueWhenComplete ?? "");
  const [deliverables, setDeliverables] = useState(i?.workRequired ?? "");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function draft() {
    setDrafting(true);
    setDraftError(null);
    const r = await draftFromName(name2, cim);
    setDrafting(false);
    if (!r.ok) { setDraftError(r.error); return; }
    try {
      const json = JSON.parse(r.text.replace(/^```(?:json)?|```$/g, "").trim());
      if (json.problem) setProblem(String(json.problem));
      if (json.objective) setObjective(String(json.objective));
      if (json.deliverables) setDeliverables(String(json.deliverables));
      if (json.kpi) {
        const [m, t] = String(json.kpi).split(/->|→/).map((s: string) => s.trim());
        if (m) setMetric(m);
        if (t) setTarget(t);
      }
    } catch {
      setDraftError("Claude returned an unexpected format. Try again.");
    }
  }

  const onCimChange = (v: string) => {
    setCim(v);
    if (isNew && !codeTouched) setCode(nextCode(CIM_TO_PREFIX[v] ?? "SI", usedCodes));
  };

  const ownerOptions = useMemo(() => [...new Set(owners.filter(Boolean))].sort(), [owners]);
  // KPIs derive from the picked CIM item; fall back to the broad driver's list.
  const kpiOptions = (cimItem && cimKpis[cimItem]?.length ? cimKpis[cimItem] : CIM_KPIS[cim]) ?? [];
  // Any team names not in the People directory (legacy free-text) still show as chips.
  const teamChips = useMemo(() => [...new Set([...ownerOptions, ...team])], [ownerOptions, team]);

  const onKpiPick = (v: string) => {
    if (!v) return;
    const [m, t] = v.split("→").map((s) => s.trim());
    setMetric(m ?? "");
    setTarget(t ?? "");
  };

  return (
    <form action={action} className="grid gap-4">
      {i && <input type="hidden" name="id" value={i.id} />}
      {i && <input type="hidden" name="updatedAt" value={i.updatedAt.toISOString()} />}
      <input type="hidden" name="effort" value={effort} />
      <input type="hidden" name="supports" value={serializeTeam(team)} />
      <input type="hidden" name="valueType" value={valueType} />

      <FormSection title="Identity" description="Where this initiative sits in the strategy, and what it's called.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CIM driver / theme" required={isNew} hint="Broad strategic driver. Used for grouping and the code prefix.">
            <NativeSelect value={cim} onChange={(e) => onCimChange(e.target.value)} name="cimDriver">
              {!CIM_DRIVERS.includes(cim) && <option value={cim}>{cim}</option>}
              {CIM_DRIVERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          </Field>
          <Field label="CIM item" hint="The CIM register item this ties back to. Sets the KPI options below.">
            <NativeSelect value={cimItem} onChange={(e) => setCimItem(e.target.value)} name="cimItemCode">
              <option value="">— none —</option>
              {cimItem && !cimItems.some((c) => c.code === cimItem) && <option value={cimItem}>{cimItem}</option>}
              {cimItems.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </NativeSelect>
          </Field>
          {areas.length > 0 && (
            <Field label="Area" hint="Strategic area in this initiative's plan. Initiatives without an area don't appear on the Strategy Review.">
              <NativeSelect name="strategicAreaId" defaultValue={i?.strategicAreaId ?? ""}>
                <option value="">— none —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="Code" required={isNew} hint={isNew ? "Suggested from the driver. Must be unique." : "Codes can't change after creation."}>
            {isNew ? (
              <Input
                name="code"
                required
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeTouched(true); }}
                className="tabular"
              />
            ) : (
              <>
                <input type="hidden" name="code" value={i!.code} />
                <ReadOnlyValue className="tabular">{i!.code}</ReadOnlyValue>
              </>
            )}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Initiative name" required>
              <Input name="name" required value={name2} onChange={(e) => setName(e.target.value)} placeholder="Plain-English name" />
            </Field>
          </div>
        </div>
      </FormSection>

      <FormSection title="People" description="Who leads it and who helps. Names come from the People directory.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lead">
            <NativeSelect name="teamLead" defaultValue={i?.teamLead ?? ""}>
              <option value="">— unassigned —</option>
              {i?.teamLead && !ownerOptions.includes(i.teamLead) && <option value={i.teamLead}>{i.teamLead}</option>}
              {ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Secondary lead">
            <NativeSelect name="secondaryLead" defaultValue={i?.secondaryLead ?? ""}>
              <option value="">— none —</option>
              {i?.secondaryLead && !ownerOptions.includes(i.secondaryLead) && <option value={i.secondaryLead}>{i.secondaryLead}</option>}
              {ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </NativeSelect>
          </Field>
        </div>
        {/* Working team: pick supporting people from the directory (Jakob). */}
        <Field label="Working team" hint="Supporting contributors beyond the lead and secondary lead." asDiv>
          {teamChips.length === 0 ? (
            <p className="text-note text-ink-faint">No people in the directory yet.</p>
          ) : (
            <TeamPicker options={teamChips} value={team} onChange={setTeam} />
          )}
        </Field>
      </FormSection>

      <FormSection
        title="Type, value & priority"
        description={
          isValue
            ? "Creates measurable dollar value. Scored on the Lift × Value map."
            : "Enabler or milestone (e.g. a key hire). No dollar value; tracked by status, not on the Lift × Value map."
        }
        action={<ValueTypeSwitch value={valueType} onChange={setValueType} />}
      >
        {isValue && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Targeted value ($/yr)" hint="Annualized value created when complete. Sets the Value score.">
              <Input
                name="targetedValue"
                value={targetedRaw}
                onChange={(e) => setTargetedRaw(e.target.value)}
                onBlur={() => setTargetedRaw(formatDollarsInput(targetedRaw))}
                placeholder="e.g. 1,500,000 or 1.5M"
                className="tabular"
              />
            </Field>
            <Field label="Value realized ($)" hint="Value captured so far. Drives % complete when both are set.">
              <Input
                name="valueRealized"
                value={realizedRaw}
                onChange={(e) => setRealizedRaw(e.target.value)}
                onBlur={() => setRealizedRaw(formatDollarsInput(realizedRaw))}
                placeholder="e.g. 500,000 or 500K"
                className="tabular"
              />
            </Field>
            <Field label="Effort" hint={EFFORT_OPTS.find((o) => o.v === effort)?.hint}>
              <NativeSelect value={effort} onChange={(e) => setEffort(e.target.value as Effort)}>
                {EFFORT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Priority (derived)" asDiv>
              <ReadOnlyValue className="flex items-center gap-2">
                <Badge variant="custom" className={`rounded ${QUADRANT_META[quadrant].bg} ${QUADRANT_META[quadrant].fg}`}>
                  {QUADRANT_META[quadrant].label}
                </Badge>
                <span className="text-note text-ink-faint">
                  Value {value} · {targeted != null ? formatMoney(targeted) : "set $"}
                </span>
              </ReadOnlyValue>
            </Field>
          </div>
        )}
      </FormSection>

      <FormSection title="Schedule & status" description="Dates drive pace and the Reporting timeline.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <NativeSelect name="status" defaultValue={i?.status ?? "IN_PROGRESS"}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </NativeSelect>
          </Field>
          {isValue ? (
            <Field label="% complete (calculated)" hint="Value realized ÷ targeted value." asDiv>
              <ReadOnlyValue className="tabular">{pctCalc != null ? `${Math.round(pctCalc * 100)}%` : "Not yet calculable"}</ReadOnlyValue>
            </Field>
          ) : (
            <Field label="Completion" hint="Tracked by status (Done = complete)." asDiv>
              <ReadOnlyValue>By status</ReadOnlyValue>
            </Field>
          )}
          <Field label="Start date" asDiv>
            <DatePicker name="startDate" label="Start date" defaultValue={dateValue(i?.startDate ?? null)} clearable />
          </Field>
          <Field label="Target date" asDiv>
            <DatePicker
              name="endDate"
              label="Target date"
              defaultValue={dateValue(i?.endDate ?? null)}
              clearable
              align="end"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="KPI" description={cimItem ? `KPI options are scoped to ${cimItem}.` : `Pick a CIM item to scope the KPI options, or choose from ${cim}.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary KPI">
            <NativeSelect onChange={(e) => onKpiPick(e.target.value)} defaultValue="" className="mb-1.5">
              <option value="">— pick a KPI for this driver —</option>
              {kpiOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </NativeSelect>
            <Input name="quantMetric" value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="The one number this moves" />
          </Field>
          <Field label="KPI target">
            <Input name="quantTarget" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. ≥4.65" />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Charter"
        description="The problem, the measurable objective and what gets delivered."
        action={
          <Button type="button" variant="accent" size="xs" onClick={draft} disabled={drafting} className="px-2.5">
            {drafting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Sparkles size={12} aria-hidden />}
            Draft from name + CIM with Claude
          </Button>
        }
      >
        {draftError && <Alert variant="risk"><TriangleAlert size={15} aria-hidden />{draftError}</Alert>}
        {problemError && <Alert variant="risk"><TriangleAlert size={15} aria-hidden />A problem statement is required before saving.</Alert>}
        <Field label="Problem statement" required hint="What is broken, for whom, and what it costs us.">
          <Textarea name="problem" required rows={3} placeholder="What is broken, for whom, and what does it cost us?" value={problem} onChange={(e) => setProblem(e.target.value)} />
        </Field>
        <Field label="Objective">
          <Textarea name="valueWhenComplete" rows={3} placeholder="One measurable sentence: clearly done or not done at closeout." value={objective} onChange={(e) => setObjective(e.target.value)} />
        </Field>
        <Field label="Deliverables">
          <Textarea name="workRequired" rows={3} placeholder="Concrete outputs: a doc, tool, dashboard, recommendation." value={deliverables} onChange={(e) => setDeliverables(e.target.value)} />
        </Field>
      </FormSection>

      {/* Sticky save bar: stays in reach at the bottom of the scrolling inset. */}
      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center gap-3 border-t border-border bg-bg/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        {i && (
          <span className="ml-auto text-note text-ink-faint">
            Last saved {i.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
      </div>
    </form>
  );
}

/** A titled form card: heading + one-line description on the left, an optional control on the right. */
function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-md border border-border bg-surface px-4 py-4 sm:px-5">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-5 text-ink-muted">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** A value the form shows but doesn't let you type: same height as an input, no box. */
function ReadOnlyValue({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex min-h-9 items-center rounded-md bg-surface-2 px-3 text-sm text-ink-muted ${className}`}>{children}</div>;
}

function Field({
  label,
  required,
  hint,
  children,
  asDiv,
}: {
  label: string;
  required?: boolean;
  hint?: string;
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
      {hint && <span className="text-micro leading-snug text-ink-faint">{hint}</span>}
    </Wrap>
  );
}

/** Working-team chips: multi-select people; selected chips carry a check, not colour alone. */
export function TeamPicker({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <ToggleGroup type="multiple" variant="chip" size="xs" value={value} onValueChange={onChange} aria-label="Working team">
        {options.map((name) => (
          <ToggleGroupItem key={name} value={name} className="group px-2.5 py-1 text-note font-normal">
            <Check size={11} strokeWidth={2.5} className="hidden group-data-[state=on]:block" aria-hidden />
            {name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-micro text-ink-faint" aria-live="polite">
        {value.length === 0 ? "No one selected" : `${value.length} selected: ${value.join(", ")}`}
      </p>
    </div>
  );
}

/** Value / Non-value switch (single choice, never empty). */
export function ValueTypeSwitch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ToggleGroup type="single" size="xs" value={value} onValueChange={(v) => v && onChange(v)} aria-label="Initiative type" className="[&>button]:px-2.5 [&>button]:py-1 [&>button]:text-note">
      <ToggleGroupItem value="VALUE">Value</ToggleGroupItem>
      <ToggleGroupItem value="NON_VALUE">Non-value</ToggleGroupItem>
    </ToggleGroup>
  );
}
