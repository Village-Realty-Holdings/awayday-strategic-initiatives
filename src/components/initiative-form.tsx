"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
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
  const toggleTeam = (name: string) =>
    setTeam((t) => (t.includes(name) ? t.filter((x) => x !== name) : [...t, name]));

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
    <form action={action} className="flex flex-col gap-5">
      {i && <input type="hidden" name="id" value={i.id} />}
      {i && <input type="hidden" name="updatedAt" value={i.updatedAt.toISOString()} />}
      <input type="hidden" name="effort" value={effort} />
      <input type="hidden" name="supports" value={serializeTeam(team)} />
      <input type="hidden" name="valueType" value={valueType} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CIM driver / theme" required={isNew} hint="Broad strategic driver. Used for grouping and the code prefix.">
          <select value={cim} onChange={(e) => onCimChange(e.target.value)} name="cimDriver" className={input}>
            {!CIM_DRIVERS.includes(cim) && <option value={cim}>{cim}</option>}
            {CIM_DRIVERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="CIM item" hint="The CIM register item this ties back to. Sets the KPI options below.">
          <select value={cimItem} onChange={(e) => setCimItem(e.target.value)} name="cimItemCode" className={input}>
            <option value="">— none —</option>
            {cimItem && !cimItems.some((c) => c.code === cimItem) && <option value={cimItem}>{cimItem}</option>}
            {cimItems.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Code" required={isNew}>
          {isNew ? (
            <input
              name="code"
              required
              value={code}
              onChange={(e) => { setCode(e.target.value); setCodeTouched(true); }}
              className={`${input} tabular`}
            />
          ) : (
            <>
              <input type="hidden" name="code" value={i!.code} />
              <p className="tabular py-2 text-sm text-ink-muted">{i!.code} (fixed)</p>
            </>
          )}
        </Field>
        <Field label="Initiative name" required>
          <input name="name" required value={name2} onChange={(e) => setName(e.target.value)} placeholder="Plain-English name" className={input} />
        </Field>
        <Field label="Lead">
          <select name="teamLead" defaultValue={i?.teamLead ?? ""} className={input}>
            <option value="">— unassigned —</option>
            {i?.teamLead && !ownerOptions.includes(i.teamLead) && <option value={i.teamLead}>{i.teamLead}</option>}
            {ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Secondary lead">
          <select name="secondaryLead" defaultValue={i?.secondaryLead ?? ""} className={input}>
            <option value="">— none —</option>
            {i?.secondaryLead && !ownerOptions.includes(i.secondaryLead) && <option value={i.secondaryLead}>{i.secondaryLead}</option>}
            {ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </div>

      {/* Working team: pick supporting people from the directory (Jakob). */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-muted">Working team</p>
        {teamChips.length === 0 ? (
          <p className="text-[11px] text-ink-faint">No people in the directory yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {teamChips.map((name) => {
              const on = team.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleTeam(name)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    on ? "border-navy bg-navy text-white" : "border-border bg-surface text-ink-muted hover:border-navy/50"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-1 text-[10px] text-ink-faint">Supporting contributors beyond the lead and secondary lead.</p>
      </div>

      {/* Type + value & priority */}
      <div className="rounded-lg border border-border bg-surface-2/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Type, value &amp; priority</p>
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
            {[
              { v: "VALUE", label: "Value" },
              { v: "NON_VALUE", label: "Non-value" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setValueType(o.v)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  valueType === o.v ? "bg-navy text-white" : "text-ink-muted hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-ink-faint">
          {isValue
            ? "Creates measurable dollar value. Scored on the Lift × Value map."
            : "Enabler / milestone (e.g. a key hire). No dollar value; tracked by status, not on the Lift × Value map."}
        </p>

        {isValue && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Targeted value ($/yr)" hint="Annualized value created when complete. Sets the Value score.">
              <input
                name="targetedValue"
                value={targetedRaw}
                onChange={(e) => setTargetedRaw(e.target.value)}
                onBlur={() => setTargetedRaw(formatDollarsInput(targetedRaw))}
                placeholder="e.g. 1,500,000 or 1.5M"
                className={`${input} tabular`}
              />
            </Field>
            <Field label="Value realized ($)" hint="Value captured so far. Drives % complete when both are set.">
              <input
                name="valueRealized"
                value={realizedRaw}
                onChange={(e) => setRealizedRaw(e.target.value)}
                onBlur={() => setRealizedRaw(formatDollarsInput(realizedRaw))}
                placeholder="e.g. 500,000 or 500K"
                className={`${input} tabular`}
              />
            </Field>
            <Field label="Effort" hint={EFFORT_OPTS.find((o) => o.v === effort)?.hint}>
              <select value={effort} onChange={(e) => setEffort(e.target.value as Effort)} className={input}>
                {EFFORT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Priority (derived)">
              <div className="flex items-center gap-2 py-1.5">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${QUADRANT_META[quadrant].bg} ${QUADRANT_META[quadrant].fg}`}>
                  {QUADRANT_META[quadrant].label}
                </span>
                <span className="text-[11px] text-ink-faint">
                  Value {value} · {targeted != null ? formatMoney(targeted) : "set $"}
                </span>
              </div>
            </Field>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Status">
          <select name="status" defaultValue={i?.status ?? "IN_PROGRESS"} className={input}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </Field>
        {isValue ? (
          <Field label="% complete (calculated)" hint="Value realized ÷ targeted value.">
            <p className="tabular py-2 text-sm text-ink">{pctCalc != null ? `${Math.round(pctCalc * 100)}%` : "—"}</p>
          </Field>
        ) : (
          <Field label="Completion" hint="Tracked by status (Done = complete).">
            <p className="py-2 text-sm text-ink-muted">By status</p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary KPI" hint={cimItem ? `Scoped to ${cimItem}.` : `Pick a CIM item to scope these, or by ${cim}.`}>
          <select onChange={(e) => onKpiPick(e.target.value)} defaultValue="" className={`${input} mb-1.5`}>
            <option value="">— pick a KPI for this driver —</option>
            {kpiOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input name="quantMetric" value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="The one number this moves" className={input} />
        </Field>
        <Field label="KPI target">
          <input name="quantTarget" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. ≥4.65" className={input} />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-surface-2/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Charter</p>
          <button
            type="button"
            onClick={draft}
            disabled={drafting}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-navy-deep transition-colors hover:bg-gold/20 disabled:opacity-60"
          >
            {drafting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Sparkles size={12} aria-hidden />}
            Draft from name + CIM with Claude
          </button>
        </div>
        {draftError && <p className="mb-2 text-[11px] text-risk">{draftError}</p>}
        {problemError && <p className="mb-2 text-[11px] text-risk">A problem statement is required before saving.</p>}
        <div className="flex flex-col gap-4">
          <Field label="Problem statement" required hint="Required. What is broken, for whom, and what it costs us.">
            <textarea name="problem" required rows={2} placeholder="What is broken, for whom, and what does it cost us?" value={problem} onChange={(e) => setProblem(e.target.value)} className={input} />
          </Field>
          <Field label="Objective">
            <textarea name="valueWhenComplete" rows={2} placeholder="One measurable sentence: clearly done or not done at closeout." value={objective} onChange={(e) => setObjective(e.target.value)} className={input} />
          </Field>
          <Field label="Deliverables">
            <textarea name="workRequired" rows={2} placeholder="Concrete outputs: a doc, tool, dashboard, recommendation." value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className={input} />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep">
          {submitLabel}
        </button>
        <Link href={cancelHref} className="text-sm text-ink-muted transition-colors hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}

const input =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-navy";

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
  const Wrap = asDiv ? "div" : "label";
  return (
    <Wrap className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-risk"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] leading-snug text-ink-faint">{hint}</span>}
    </Wrap>
  );
}
