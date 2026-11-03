import {
  addInitiativeMeasure,
  addInitiativeMeasureReading,
  removeInitiativeMeasure,
  removeInitiativeMeasureReading,
  setPrimaryInitiativeMeasure,
  updateInitiativeMeasure,
} from "@/app/(app)/initiatives/actions";
import { ProgressBar } from "@/components/badges";
import { DatePicker } from "@/components/date-picker";
import { Target } from "@/components/icons";
import { DetailList, DetailSection, RemoveButton } from "@/components/initiative-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { todayISO } from "@/lib/calendar";
import { formatDateDay } from "@/lib/initiatives";
import {
  formatMeasureValue,
  MEASURE_KIND_LABEL,
  MEASURE_KINDS,
  MEASURE_UNIT_LABEL,
  MEASURE_UNITS,
  measureProgress,
  measureValueInput,
  primaryKpi,
  sortReadings,
} from "@/lib/measures";

type Reading = { id: string; value: number; asOf: Date; note: string | null; enteredBy: string | null; createdAt: Date };
type Measure = {
  id: string;
  name: string;
  kind: string;
  unit: string;
  baseline: number | null;
  target: number | null;
  order: number;
  createdAt: Date;
  readings: Reading[];
};

/** The KPIs and leading measures an initiative drives, each with its dated updates. */
export function InitiativeMeasures({
  initiativeId,
  measures,
  editable,
  isValue,
  dollarsDrivePct,
  suggestedName,
}: {
  initiativeId: string;
  measures: Measure[];
  editable: boolean;
  isValue: boolean;
  dollarsDrivePct: boolean;
  /** Pre-fills the first measure's name from the charter's Metric. */
  suggestedName: string | null;
}) {
  // Only value initiatives take a percent from a KPI, and only without dollars.
  const kpiDrivesPct = isValue && !dollarsDrivePct;
  const primary = kpiDrivesPct ? primaryKpi(measures) : null;

  return (
    <DetailSection
      icon={Target}
      title="KPIs & leading measures"
      count={measures.length > 0 && String(measures.length)}
      isEmpty={measures.length === 0}
      emptyText="No KPIs or leading measures yet."
      addLabel={editable ? "Add measure" : undefined}
      addForm={
        editable && (
          <form action={addInitiativeMeasure} className="grid gap-2">
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <MeasureFields defaultName={measures.length === 0 ? suggestedName : null} />
            <p className="text-note text-ink-faint">
              If lower is better, set the target below the baseline. Enter 15 for 15%.
            </p>
            <div>
              <SubmitButton variant="secondary" size="sm">Add measure</SubmitButton>
            </div>
          </form>
        )
      }
    >
      <DetailList>
        {measures.map((m) => (
          <MeasureRow
            key={m.id}
            measure={m}
            editable={editable}
            drivesPct={primary?.id === m.id}
            canDrivePct={kpiDrivesPct && m.kind === "KPI"}
          />
        ))}
      </DetailList>
    </DetailSection>
  );
}

function MeasureRow({
  measure: m,
  editable,
  drivesPct,
  canDrivePct,
}: {
  measure: Measure;
  editable: boolean;
  drivesPct: boolean;
  canDrivePct: boolean;
}) {
  const readings = sortReadings(m.readings);
  const latest = readings[0];
  const progress = measureProgress(m);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 text-sm font-medium text-ink">{m.name}</p>
        <Badge variant={m.kind === "KPI" ? "default" : "secondary"}>{MEASURE_KIND_LABEL[m.kind] ?? m.kind}</Badge>
        {drivesPct && <Badge variant="outline">Drives % complete</Badge>}
        {editable && (
          <div className="ml-auto">
            <RemoveButton
              action={removeInitiativeMeasure}
              id={m.id}
              title="Remove measure?"
              description={`Remove “${m.name}” and its ${readings.length === 1 ? "1 update" : `${readings.length} updates`}? This can't be undone.`}
            />
          </div>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Baseline">{formatMeasureValue(m.baseline, m.unit)}</Stat>
        <Stat label={latest ? `Latest · ${formatDateDay(latest.asOf)}` : "Latest"}>
          <span className="font-semibold">{formatMeasureValue(latest?.value, m.unit)}</span>
        </Stat>
        <Stat label="Target">{formatMeasureValue(m.target, m.unit)}</Stat>
        <Stat label="Progress">
          {progress !== null ? (
            <ProgressBar value={progress} />
          ) : (
            <span className="text-note text-ink-faint">
              {m.baseline == null || m.target == null ? "Needs baseline and target" : latest ? "—" : "No updates yet"}
            </span>
          )}
        </Stat>
      </dl>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {editable && (
          <Disclosure label="Update">
            <form action={addInitiativeMeasureReading} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="measureId" value={m.id} />
              <Input size="sm" name="value" required inputMode="decimal" aria-label={`Latest value of ${m.name}`} placeholder="Latest value" className="tabular w-32" />
              <div className="w-44"><DatePicker name="asOf" label="As of" defaultValue={todayISO()} align="start" /></div>
              <Input size="sm" name="note" aria-label="Note" placeholder="Note (optional)" className="min-w-48 flex-1" />
              <SubmitButton variant="secondary" size="sm">Save update</SubmitButton>
            </form>
          </Disclosure>
        )}
        {readings.length > 0 && (
          <Disclosure label={`History (${readings.length})`}>
            <ul className="divide-y divide-border">
              {readings.map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-1.5 text-xs">
                  <span className="tabular w-24 shrink-0 text-ink-faint">{formatDateDay(r.asOf)}</span>
                  <span className="tabular w-24 shrink-0 font-medium text-ink">{formatMeasureValue(r.value, m.unit)}</span>
                  <span className="min-w-0 flex-1 text-ink-muted">
                    {[r.note, r.enteredBy].filter(Boolean).join(" · ")}
                  </span>
                  {editable && (
                    <RemoveButton
                      action={removeInitiativeMeasureReading}
                      id={r.id}
                      title="Remove update?"
                      description={`Remove the ${formatDateDay(r.asOf)} update of ${formatMeasureValue(r.value, m.unit)}? This can't be undone.`}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        {editable && (
          <Disclosure label="Edit">
            <form action={updateInitiativeMeasure} className="grid gap-2">
              <input type="hidden" name="id" value={m.id} />
              <MeasureFields measure={m} />
              <div>
                <SubmitButton variant="secondary" size="sm">Save measure</SubmitButton>
              </div>
            </form>
          </Disclosure>
        )}
        {editable && canDrivePct && !drivesPct && (
          <form action={setPrimaryInitiativeMeasure}>
            <input type="hidden" name="id" value={m.id} />
            <Button type="submit" variant="faint" size="bare" className="text-xs font-medium text-navy hover:text-navy-deep">
              Use for % complete
            </Button>
          </form>
        )}
      </div>
    </li>
  );
}

function MeasureFields({ measure, defaultName }: { measure?: Measure; defaultName?: string | null }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input size="sm" name="name" required defaultValue={measure?.name ?? defaultName ?? ""} aria-label="Measure name" placeholder="Measure name" className="min-w-48 flex-1" />
      <NativeSelect size="sm" name="kind" defaultValue={measure?.kind ?? "KPI"} aria-label="Type" className="w-28 px-2">
        {MEASURE_KINDS.map((k) => <option key={k} value={k}>{MEASURE_KIND_LABEL[k]}</option>)}
      </NativeSelect>
      <NativeSelect size="sm" name="unit" defaultValue={measure?.unit ?? "NUMBER"} aria-label="Unit" className="w-28 px-2">
        {MEASURE_UNITS.map((u) => <option key={u} value={u}>{MEASURE_UNIT_LABEL[u]}</option>)}
      </NativeSelect>
      <Input size="sm" name="baseline" inputMode="decimal" defaultValue={measureValueInput(measure?.baseline ?? null)} aria-label="Baseline" placeholder="Baseline" className="tabular w-28" />
      <Input size="sm" name="target" inputMode="decimal" defaultValue={measureValueInput(measure?.target ?? null)} aria-label="Target" placeholder="Target" className="tabular w-28" />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-note text-ink-faint">{label}</dt>
      <dd className="tabular text-ink">{children}</dd>
    </div>
  );
}

/** A quiet native disclosure, so the plain server-action forms inside need no client JS. */
function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group open:basis-full">
      <summary className="inline-flex cursor-pointer list-none text-xs font-medium text-navy hover:text-navy-deep group-open:text-ink [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
