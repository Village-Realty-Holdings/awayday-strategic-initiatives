"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, TriangleAlert } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import type { Initiative } from "@/generated/prisma/client";
import { draftFromName } from "@/app/(app)/ai-actions";
import { CharterRowsEditor } from "@/components/charter-rows-editor";
import type { DependencyRow, MilestoneRow, RiskRow } from "@/lib/charter-rows";

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

const PEOPLE_LIST = "initiative-people";

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
  cimKpis = {},
  areas = [],
  charter,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initiative?: Initiative;
  submitLabel: string;
  cancelHref: string;
  owners?: string[];
  usedCodes?: string[];
  cimKpis?: Record<string, string[]>;
  /** The plan's strategic areas, each with its "KPI → target" labels from the database. */
  areas?: { id: string; code: string; name: string; kind: string; kpis: string[] }[];
  /** The charter's tables, for editing; omitted for a new initiative. */
  charter?: { risks: RiskRow[]; dependencies: DependencyRow[]; milestones: MilestoneRow[] };
}) {
  const i = initiative;
  const isNew = !i;

  // CIM + auto-code (new only)
  const initialCim = i?.cimDriver ?? CIM_DRIVERS[0];
  const [cim, setCim] = useState(initialCim);
  const [areaId, setAreaId] = useState(i?.strategicAreaId ?? "");
  const [code, setCode] = useState(() => (isNew ? nextCode(CIM_TO_PREFIX[CIM_DRIVERS[0]] ?? "SI", usedCodes) : i!.code));
  const [codeTouched, setCodeTouched] = useState(false);

  // KPI helper -> fills metric/target
  const [metric, setMetric] = useState(i?.quantMetric ?? "");
  const [target, setTarget] = useState(i?.quantTarget ?? "");

  // Charter fields (controlled so the Claude draft can fill them)
  const [name2, setName] = useState(i?.name ?? "");
  const [objective, setObjective] = useState(i?.valueWhenComplete ?? "");
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
      if (json.objective) setObjective(String(json.objective));
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
  // KPI suggestions, all from the database: the scorecard KPIs tied to the
  // picked CIM item, else the KPIs of the picked strategic area.
  const cimItemKpis = i?.cimItemCode ? (cimKpis[i.cimItemCode] ?? []) : [];
  const kpiOptions = cimItemKpis.length ? cimItemKpis : (areas.find((a) => a.id === areaId)?.kpis ?? []);

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
      <datalist id={PEOPLE_LIST}>
        {ownerOptions.map((o) => <option key={o} value={o} />)}
      </datalist>

      {/* Laid out like the one-page SI charter: header strip, then sections 1-5. */}
      <section className="grid gap-4 rounded-md border border-border bg-surface px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="Initiative name / ID" required>
          <div className="flex gap-2">
            {isNew ? (
              <Input
                name="code"
                required
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeTouched(true); }}
                aria-label="Code"
                className="tabular w-28 shrink-0"
              />
            ) : (
              <>
                <input type="hidden" name="code" value={i!.code} />
                <ReadOnlyValue className="tabular shrink-0">{i!.code}</ReadOnlyValue>
              </>
            )}
            <Input name="name" required value={name2} onChange={(e) => setName(e.target.value)} placeholder="Plain-English name" className="min-w-0 flex-1" />
          </div>
        </Field>
        <Field label="ELT sponsor">
          <PersonSelect name="secondaryLead" value={i?.secondaryLead} options={ownerOptions} empty="— none —" />
        </Field>
        <Field label="SI lead">
          <PersonSelect name="teamLead" value={i?.teamLead} options={ownerOptions} empty="— unassigned —" />
        </Field>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FormSection
          title="1. Objective"
          description="What this initiative is, and why it matters: what changes for owners, guests or the P&L, and what happens if we don't do it."
          action={
            <Button type="button" variant="accent" size="xs" onClick={draft} disabled={drafting} className="px-2.5">
              {drafting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Sparkles size={12} aria-hidden />}
              Draft with Claude
            </Button>
          }
        >
          {draftError && <Alert variant="risk"><TriangleAlert size={15} aria-hidden />{draftError}</Alert>}
          <Textarea name="valueWhenComplete" rows={7} aria-label="Objective" placeholder="Two or three lines." value={objective} onChange={(e) => setObjective(e.target.value)} />
        </FormSection>

        <FormSection title="2. Value">
          <Field label="Metric">
            {kpiOptions.length > 0 && (
              <NativeSelect onChange={(e) => onKpiPick(e.target.value)} defaultValue="" className="mb-1.5" aria-label="Pick a KPI">
                <option value="">— pick a KPI —</option>
                {kpiOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </NativeSelect>
            )}
            <Input name="quantMetric" value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="The one number this moves" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Baseline">
              <Input name="baseline" defaultValue={i?.baseline ?? ""} placeholder="Where it is today" />
            </Field>
            <Field label="FY27 target + stretch">
              <Input name="quantTarget" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 30 days; 25 stretch" />
            </Field>
          </div>
          <Field label="EBITDA value ($)" hint="If applicable at SI level.">
            <Input name="ebitdaValue" defaultValue={i?.ebitdaValue ?? ""} placeholder="e.g. $11M (~30 extra tuck-ins per yr)" />
          </Field>
          <Field label="Investment cost ($)" hint="To deliver the SI.">
            <Input name="investmentCost" defaultValue={i?.investmentCost ?? ""} placeholder="e.g. ~$150K" />
          </Field>
        </FormSection>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <FormSection title="3. Risks and mitigations">
          <CharterRowsEditor
            name="risksJson"
            rowLabel="Risk"
            peopleListId={PEOPLE_LIST}
            initialRows={charter?.risks ?? []}
            addLabel="Add risk"
            emptyText="No risks logged."
            columns={[
              { key: "risk", label: "Risk", kind: "long" },
              { key: "mitigation", label: "Mitigation", kind: "long" },
              { key: "owner", label: "Owner", kind: "person", width: "8rem" },
            ]}
          />
        </FormSection>
        <FormSection title="4. Dependencies">
          <CharterRowsEditor
            name="dependenciesJson"
            rowLabel="Dependency"
            peopleListId={PEOPLE_LIST}
            initialRows={charter?.dependencies ?? []}
            addLabel="Add dependency"
            emptyText="No dependencies."
            columns={[
              { key: "need", label: "What we need", kind: "long" },
              { key: "fromWhom", label: "From whom", kind: "person", width: "8rem" },
              { key: "byWhen", label: "By when", placeholder: "Date, Q1 2027, TBD", width: "7.5rem" },
            ]}
          />
        </FormSection>
      </div>

      <FormSection title="5. Milestones to first value">
        <CharterRowsEditor
          name="milestonesJson"
          rowLabel="Milestone"
          peopleListId={PEOPLE_LIST}
          initialRows={charter?.milestones ?? []}
          addLabel="Add milestone"
          emptyText="No milestones yet."
          columns={[
            { key: "title", label: "Milestone", kind: "long" },
            { key: "owner", label: "Owner", kind: "person", width: "12rem" },
            { key: "dueAt", label: "Due date", kind: "date", width: "11rem" },
          ]}
        />
      </FormSection>

      {/* Where a new SI sits: the driver sets its code prefix, and without an area it never appears on the Strategy Review. */}
      {isNew && (
        <section className="grid gap-4 rounded-md border border-border bg-surface px-4 py-4 sm:grid-cols-2 sm:px-5">
          <Field label="CIM driver / theme" required hint="Broad strategic driver. Sets the suggested code prefix.">
            <NativeSelect value={cim} onChange={(e) => onCimChange(e.target.value)} name="cimDriver">
              {CIM_DRIVERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          </Field>
          {areas.length > 0 && (
            <Field label="Area" hint="Strategic area in the active plan. Initiatives without an area don't appear on the Strategy Review. Its KPIs are offered as metrics.">
              <NativeSelect name="strategicAreaId" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">— none —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </Field>
          )}
        </section>
      )}

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

/** People picker that keeps a stored name missing from the directory. */
function PersonSelect({ name, value, options, empty }: { name: string; value?: string | null; options: string[]; empty: string }) {
  return (
    <NativeSelect name={name} defaultValue={value ?? ""}>
      <option value="">{empty}</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </NativeSelect>
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
