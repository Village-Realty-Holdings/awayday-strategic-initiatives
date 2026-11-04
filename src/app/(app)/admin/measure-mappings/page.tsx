import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { getActivePlan } from "@/lib/active-plan";
import { mappingInputKeys, missingMeasureInputs, type MeasureMapping } from "@/lib/kpi-measure-mapping";
import { prisma } from "@/lib/prisma";
import { getReviewPlan, loadMappingInputs, resolvePeriod } from "@/lib/review-data";
import { periodLabel, ragLabel, type ReviewMeasure } from "@/lib/review-model";
import { requireAdmin } from "@/lib/session";
import { adminSaveMeasureMapping } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Measure mappings — Awayday" };

const ERRORS: Record<string, string> = {
  "not-in-plan": "That measure is not in the active plan. Reload the page and try again.",
  "ratio-inputs": "A margin change needs both a numerator and a denominator metric.",
  "unknown-metric": "Choose metrics from the imported list.",
};

const CALCULATIONS = [
  { value: "DIRECT", label: "Use the imported value as is" },
  { value: "YOY_PCT", label: "Growth vs prior year (%)" },
  { value: "RATIO_DELTA_PY", label: "Margin change vs prior year (points)" },
];
const TIME_BASES = [
  { value: "MONTHLY", label: "Month" },
  { value: "YTD", label: "YTD" },
  { value: "LTM", label: "LTM / TTM" },
  { value: "POINT_IN_TIME", label: "Point in time" },
];
const FORMATS = [
  { value: "percent", label: "Percent" },
  { value: "currency", label: "Currency" },
  { value: "number", label: "Number" },
];

const FIELD = "flex flex-col gap-1.5";

type MetricOption = { metricKey: string; name: string };

function MetricSelect({ name, value, metrics, empty }: { name: string; value: string | null | undefined; metrics: MetricOption[]; empty: string }) {
  // A saved key with no definition yet stays selectable, so saving doesn't drop it.
  const unknown = value && !metrics.some((m) => m.metricKey === value);
  return (
    <NativeSelect name={name} defaultValue={value ?? ""}>
      <option value="">{empty}</option>
      {unknown && <option value={value}>{value} (not imported yet)</option>}
      {metrics.map((m) => (
        <option key={m.metricKey} value={m.metricKey}>
          {m.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function statusLine(measure: ReviewMeasure | null | undefined, month: string, missing: string[], mapping: MeasureMapping | null): string {
  if (!mapping) return "Not mapped yet.";
  if (measure?.value) {
    const rating = ragLabel(measure.rag);
    if (measure.source === "manual") return `${month}: ${measure.value} · ${rating}. Entered by hand, which replaces the calculated value.`;
    if (measure.source === "import") return `${month}: ${measure.value} · ${rating}. Published directly on this measure, which replaces the calculated value.`;
    return `${month}: ${measure.value} · ${rating}. Calculated from ${measure.inputs?.join(" and ")}.`;
  }
  if (missing.length) return `${month}: no value. Waiting for ${missing.join("; ")}.`;
  return `${month}: no value. The inputs can't be calculated, for example a prior-year value of zero.`;
}

// Which imported metrics fill each pillar measure, and how its status is rated.
export default async function MeasureMappingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const plan = await getActivePlan();
  const { id: period } = await resolvePeriod(null, "review");
  const [areas, metrics, review] = await Promise.all([
    plan
      ? prisma.strategicArea.findMany({
          where: { planVersionId: plan.id },
          orderBy: [{ kind: "desc" }, { order: "asc" }],
          // Same order as the review, so this is the KPI the review shows.
          select: { id: true, name: true, kpis: { orderBy: { name: "asc" }, take: 1, select: { id: true, name: true, target: true, measureMapping: true } } },
        })
      : [],
    prisma.kpiDefinition.findMany({ where: { strategicAreaId: null }, orderBy: { name: "asc" }, select: { metricKey: true, name: true } }),
    getReviewPlan(period),
  ]);

  const mapped = areas.flatMap((a) => a.kpis.flatMap((k) => (k.measureMapping ? [k.measureMapping] : [])));
  const inputs = await loadMappingInputs([...new Set(mapped.flatMap(mappingInputKeys))], period);
  const month = periodLabel(period);
  const withoutMeasure = areas.filter((a) => a.kpis.length === 0).map((a) => a.name);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Measure mappings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Which imported metrics fill each measure on the Strategy Review, and how its status is rated. Values are calculated when the review loads, so editing a
          mapping or revising an input also changes months already published. A value entered by hand on the review replaces the calculated one.
        </p>
        {error && ERRORS[error] && <p className="mt-4 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">{ERRORS[error]}</p>}
      </div>

      {areas.map((area) => {
        const kpi = area.kpis[0];
        if (!kpi) return null;
        const mapping = kpi.measureMapping;
        const measure = review.areas.find((a) => a.id === area.id)?.measure;
        const missing = mapping ? missingMeasureInputs(mapping, inputs.rows, period, inputs.names) : [];
        return (
          <section key={kpi.id} id={`measure-${kpi.id}`} className="scroll-mt-24 rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">
              {area.name} · {kpi.name}
            </h2>
            <p className="mt-1 text-note text-ink-muted">Plan target: {kpi.target || "not set"}</p>
            <p className="mt-1 text-note text-ink-muted">{mapping && !mapping.active ? "Switched off." : statusLine(measure, month, missing, mapping)}</p>
            <form action={adminSaveMeasureMapping} className="mt-4 flex flex-col gap-4">
              <input type="hidden" name="measureKpiId" value={kpi.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Label className={FIELD}>
                  Calculation
                  <NativeSelect name="calculation" defaultValue={mapping?.calculation ?? "DIRECT"}>
                    {CALCULATIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Label>
                <Label className={FIELD}>
                  Period type
                  <NativeSelect name="timeBasis" defaultValue={mapping?.timeBasis ?? "YTD"}>
                    {TIME_BASES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Label>
                <Label className={FIELD}>
                  Input metric (numerator for margin change)
                  <MetricSelect name="inputMetricKey" value={mapping?.inputMetricKey} metrics={metrics} empty="Not set" />
                </Label>
                <Label className={FIELD}>
                  Denominator (margin change only)
                  <MetricSelect name="denominatorMetricKey" value={mapping?.denominatorMetricKey} metrics={metrics} empty="Not set" />
                </Label>
                <Label className={FIELD}>
                  Better when
                  <NativeSelect name="direction" defaultValue={mapping?.higherIsBetter === false ? "LOWER" : "HIGHER"}>
                    <option value="HIGHER">Higher</option>
                    <option value="LOWER">Lower</option>
                  </NativeSelect>
                </Label>
                <Label className={FIELD}>
                  Display as (imported value only)
                  <NativeSelect name="displayFormat" defaultValue={mapping?.displayFormat ?? "percent"}>
                    {FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Label>
                <Label className={FIELD}>
                  Budget target
                  <Input name="targetBudget" type="number" step="any" defaultValue={mapping?.targetBudget ?? ""} />
                </Label>
                <Label className={FIELD}>
                  Stretch target
                  <Input name="targetStretch" type="number" step="any" defaultValue={mapping?.targetStretch ?? ""} />
                </Label>
              </div>
              <p className="text-note text-ink-muted">
                Enter targets in full: $26M as 26000000, 11% as 11. Status compares the value with the budget target, and shows no rating without one.
              </p>
              <div className="flex items-center justify-between gap-3">
                {/* relative: Radix's hidden form input is absolute, and would otherwise stretch the document. */}
                <Label className="relative flex items-center gap-2">
                  <Checkbox name="active" defaultChecked={mapping?.active ?? true} />
                  Use this mapping on the review
                </Label>
                <SubmitButton size="sm" variant="outline">
                  Save mapping
                </SubmitButton>
              </div>
            </form>
          </section>
        );
      })}

      {withoutMeasure.length > 0 && <p className="text-note text-ink-muted">No measure defined, so nothing to map: {withoutMeasure.join(", ")}.</p>}
    </div>
  );
}
