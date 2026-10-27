import { Plus, Trash2 } from "@/components/icons";
import { ConfirmAction } from "@/components/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/session";
import { getEbitdaBuild, getPillars, getScorecardGoals } from "@/lib/strategy-reference-data";
import { BRIDGE_KINDS, GOAL_COLORS, formatPillarItems, type BridgeRow, type Goal, type Pillar } from "@/lib/strategy-reference";
import {
  adminDeletePillar,
  adminDeleteScorecardGoal,
  adminSaveScorecardGoal,
  adminSavePillar,
  adminSetEbitdaBuild,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strategy reference — Awayday" };

const ERRORS: Record<string, string> = {
  "pillar-name": "A pillar needs a name.",
  "goal-name": "A goal needs a category and a name.",
  "goal-missing": "That goal no longer exists.",
};

const SECTION = "scroll-mt-24 rounded-xl border border-border bg-surface p-5";
const FIELD = "flex flex-col gap-1.5";
const BLANK_ROWS = 3;

export default async function StrategyReferencePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const [ebitda, pillars, goals] = await Promise.all([getEbitdaBuild(), getPillars(), getScorecardGoals()]);
  const bridge: (BridgeRow | null)[] = [...(ebitda?.bridge ?? []), ...Array<null>(BLANK_ROWS).fill(null)];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Strategy reference</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The EBITDA build, the 2026 pillars and the Financial &amp; Operating Scorecard goals. The AI board update and
          Ask panel quote these figures, and the scorecard goals&apos; CIM links suggest KPIs on the initiative form.
        </p>
        {error && ERRORS[error] && (
          <p className="mt-4 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">{ERRORS[error]}</p>
        )}
      </div>

      <section id="ebitda" className={SECTION}>
        <h2 className="text-sm font-semibold text-ink">EBITDA build</h2>
        <p className="mt-1 text-note text-ink-muted">
          Figures in $M. Lender EBITDA is the bridge&apos;s total row and valuation EBITDA its subtotal row; both are the
          running sum of the component rows above them, so only component rows take a value.
        </p>
        <form action={adminSetEbitdaBuild} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Label className={FIELD}>
              As of
              <Input name="asOf" defaultValue={ebitda?.asOf ?? ""} maxLength={60} size="sm" placeholder="May 2026" />
            </Label>
            <Label className={FIELD}>
              2026 target
              <Input name="target2026" type="number" step="any" defaultValue={ebitda?.target2026 ?? ""} size="sm" />
            </Label>
            <Label className={FIELD}>
              2027 exit target
              <Input name="target2027" type="number" step="any" defaultValue={ebitda?.target2027 ?? ""} size="sm" />
            </Label>
            <Label className={FIELD}>
              YTD growth
              <Input name="ytdGrowth" type="number" step="any" defaultValue={ebitda?.ytdGrowth ?? ""} size="sm" />
            </Label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="text-left text-note text-ink-muted">
                  <th className="pb-1.5 font-medium">Bridge row</th>
                  <th className="w-28 pb-1.5 font-medium">Value</th>
                  <th className="w-32 pb-1.5 font-medium">Kind</th>
                </tr>
              </thead>
              <tbody>
                {bridge.map((row, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <Input name="bridgeLabel" defaultValue={row?.label ?? ""} maxLength={120} size="xs" className="w-full" aria-label={`Row ${i + 1} label`} />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        name="bridgeValue"
                        type="number"
                        step="any"
                        defaultValue={row && row.kind === "component" ? row.value : ""}
                        placeholder={row && row.kind !== "component" ? String(row.value) : ""}
                        size="xs"
                        className="w-full"
                        aria-label={`Row ${i + 1} value`}
                      />
                    </td>
                    <td className="py-1">
                      <NativeSelect name="bridgeKind" defaultValue={row?.kind ?? "component"} size="xs" className="w-full" aria-label={`Row ${i + 1} kind`}>
                        {BRIDGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </NativeSelect>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-note text-ink-faint">Clear a row&apos;s label to remove it. Save to get more blank rows.</p>
          </div>
          <p className="text-note text-ink-muted">
            Lender {ebitda?.lender ?? "—"} · valuation {ebitda?.valuation ?? "—"}
          </p>
          <div>
            <SubmitButton size="sm">Save EBITDA build</SubmitButton>
          </div>
        </form>
      </section>

      <section id="pillars" className={SECTION}>
        <h2 className="text-sm font-semibold text-ink">2026 pillars</h2>
        <p className="mt-1 text-note text-ink-muted">
          Items one per line: <code>Name | description | CIM codes | SI codes</code>. The board update rolls each
          pillar&apos;s progress up from its items&apos; SIs.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {pillars.map((p, i) => <PillarForm key={p.id} index={i} pillar={p} />)}
          <PillarForm index={pillars.length} pillar={null} />
        </div>
      </section>

      <section id="goals" className={SECTION}>
        <h2 className="text-sm font-semibold text-ink">Scorecard goals</h2>
        <p className="mt-1 text-note text-ink-muted">
          The measurable 2026 goals. Red goals are called out in the board update; each goal&apos;s CIM codes offer it as a
          KPI on initiatives tied to that CIM item.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {goals.map((g, i) => <GoalForm key={g.id} goal={g} order={i} />)}
          <GoalForm goal={null} order={goals.length} />
        </div>
      </section>
    </div>
  );
}

function PillarForm({ index, pillar }: { index: number; pillar: Pillar | null }) {
  return (
    <details className="rounded-lg border border-border/70 p-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        {pillar ? `${pillar.name} · ${pillar.items.length} items` : <span className="inline-flex items-center gap-1 text-ink-muted"><Plus size={13} aria-hidden /> Add pillar</span>}
      </summary>
      <form action={adminSavePillar} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="index" value={index} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className={FIELD}>
            Name
            <Input name="name" defaultValue={pillar?.name ?? ""} maxLength={300} size="sm" required />
          </Label>
          <Label className={FIELD}>
            Headline
            <Input name="headline" defaultValue={pillar?.headline ?? ""} maxLength={300} size="sm" />
          </Label>
        </div>
        <Label className={FIELD}>
          Items
          <Textarea name="items" defaultValue={pillar ? formatPillarItems(pillar.items) : ""} rows={Math.max(3, (pillar?.items.length ?? 0) + 1)} size="sm" className="font-mono text-xs" />
        </Label>
        <div className="flex items-center gap-2">
          <SubmitButton size="sm" variant="outline">{pillar ? "Save pillar" : "Add pillar"}</SubmitButton>
          {pillar && (
            <ConfirmAction
              action={adminDeletePillar}
              fields={{ index: String(index) }}
              title="Delete pillar?"
              description={`Delete pillar “${pillar.name}” and its ${pillar.items.length} items? This can't be undone.`}
              confirmLabel="Delete pillar"
              triggerProps={{ variant: "destructive", size: "sm", className: "px-2.5" }}
            >
              <Trash2 size={13} aria-hidden /> Delete
            </ConfirmAction>
          )}
        </div>
      </form>
    </details>
  );
}

function GoalForm({ goal, order }: { goal: Goal | null; order: number }) {
  return (
    <details className="rounded-lg border border-border/70 p-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        {goal ? (
          <>
            {goal.name} <span className="font-normal text-ink-muted">· {goal.category} · {goal.goal || "no target"} · {goal.color}</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1 text-ink-muted"><Plus size={13} aria-hidden /> Add goal</span>
        )}
      </summary>
      <form action={adminSaveScorecardGoal} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={goal?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Label className={FIELD}>
            Category
            <Input name="category" defaultValue={goal?.category ?? ""} maxLength={120} size="sm" required />
          </Label>
          <Label className={`${FIELD} sm:col-span-2`}>
            Name
            <Input name="name" defaultValue={goal?.name ?? ""} maxLength={200} size="sm" required />
          </Label>
          <Label className={FIELD}>
            Goal
            <Input name="goal" defaultValue={goal?.goal ?? ""} maxLength={200} size="sm" placeholder="<11.0%" />
          </Label>
          <Label className={FIELD}>
            Latest (LTM)
            <Input name="ltm" defaultValue={goal?.ltm ?? ""} maxLength={200} size="sm" />
          </Label>
          <Label className={FIELD}>
            YTD budget
            <Input name="ytdBud" defaultValue={goal?.ytdBud ?? ""} maxLength={200} size="sm" />
          </Label>
          <Label className={FIELD}>
            Status
            <Input name="status" defaultValue={goal?.status ?? ""} maxLength={200} size="sm" />
          </Label>
          <Label className={FIELD}>
            Colour
            <NativeSelect name="color" defaultValue={goal?.color ?? "grey"} size="sm">
              {GOAL_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          </Label>
          <Label className={FIELD}>
            Owner
            <Input name="owner" defaultValue={goal?.owner ?? ""} maxLength={200} size="sm" />
          </Label>
          <Label className={FIELD}>
            CIM codes
            <Input name="cim" defaultValue={goal?.cim.join(", ") ?? ""} size="sm" placeholder="CIM-04, CIM-05" />
          </Label>
          <Label className={FIELD}>
            SI codes
            <Input name="sis" defaultValue={goal?.sis.join(", ") ?? ""} size="sm" placeholder="M&A-01, M&A-02" />
          </Label>
          <Label className={FIELD}>
            Order
            <Input name="order" type="number" min={0} max={999} defaultValue={order} size="sm" />
          </Label>
        </div>
        <Label className={FIELD}>
          Notes
          <Textarea name="notes" defaultValue={goal?.notes ?? ""} rows={2} size="sm" />
        </Label>
        <div className="flex items-center gap-2">
          <SubmitButton size="sm" variant="outline">{goal ? "Save goal" : "Add goal"}</SubmitButton>
          {goal && (
            <ConfirmAction
              action={adminDeleteScorecardGoal}
              fields={{ id: goal.id }}
              title="Delete goal?"
              description={`Delete scorecard goal “${goal.name}”? This can't be undone.`}
              confirmLabel="Delete goal"
              triggerProps={{ variant: "destructive", size: "sm", className: "px-2.5" }}
            >
              <Trash2 size={13} aria-hidden /> Delete
            </ConfirmAction>
          )}
        </div>
      </form>
    </details>
  );
}
