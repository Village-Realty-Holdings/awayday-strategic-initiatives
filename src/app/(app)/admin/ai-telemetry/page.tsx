import Link from "next/link";
import { requireSession } from "@/lib/session";
import {
  DEFAULT_AI_MONTHLY_BUDGET_USD,
  formatMonthLabel,
  getAiBudgetSettingRaw,
  getAiBudgetStatus,
  getAlertRecipients,
  getAlertRecipientsSettingRaw,
} from "@/lib/ai-budget";
import { buildAiTelemetryReport, coerceReportDays, REPORT_DAYS } from "@/lib/ai-telemetry-report";
import { AiBudgetForm, AiBudgetRecipientsForm } from "@/components/admin/ai-budget-forms";

// Dark-launched admin surface (direct URL only, no nav or launcher link):
// the monthly AI spend guardrail and the ai_invocation telemetry report
// (docs/ai-telemetry-schema.md, rollout step 4). Styling mirrors
// /admin/org-health.
export const dynamic = "force-dynamic";

export const metadata = { title: "AI telemetry · Awayday" };

const usd = (n: number) => `$${n.toFixed(2)}`;
const pct = (r: number) => `${Math.round(r * 100)}%`;
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const when = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16) + " UTC";

export default async function AiTelemetryPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireSession({ role: "admin" });
  const days = coerceReportDays((await searchParams).days);
  const [status, recipients, budgetRaw, recipientsRaw, report] = await Promise.all([
    getAiBudgetStatus(),
    getAlertRecipients(),
    getAiBudgetSettingRaw(),
    getAlertRecipientsSettingRaw(),
    buildAiTelemetryReport(days),
  ]);

  const ratio = status.ratio ?? 0;
  const barWidth = status.budget == null ? 0 : Math.min(100, Math.round(ratio * 100));
  const barTone = !status.allowed ? "bg-risk" : ratio >= 0.8 ? "bg-warn" : "bg-navy";
  const envBudget = process.env.AI_MONTHLY_BUDGET_USD?.trim();
  const effectivePlaceholder = envBudget ? `${envBudget} (environment)` : `${DEFAULT_AI_MONTHLY_BUDGET_USD} (default)`;

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Admin · AI telemetry</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Monthly AI spend guardrail and usage across every module. When the budget is reached, AI features pause for the rest
          of the month and everything else keeps working. Nothing here stores prompts, responses, or document content.
        </p>
      </header>

      {/* Budget card */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-ink">Monthly budget · {formatMonthLabel(status.month)}</h2>
          <span className={`text-xs font-medium ${status.allowed ? "text-ok" : "text-risk"}`}>
            {status.allowed ? "AI features active" : "AI features paused: budget reached"}
          </span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
          {usd(status.spent)}
          <span className="text-sm font-normal text-ink-muted">
            {status.budget == null ? " spent this month, no cap set" : ` of ${usd(status.budget)} (${pct(ratio)})`}
          </span>
        </p>
        {status.budget != null && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={barWidth} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full ${barTone}`} style={{ width: `${barWidth}%` }} />
          </div>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          Spend is the sum of priced invocations this UTC month. Alerts go out once at 80% and once at 100%
          {recipients.length ? ` to ${recipients.join(", ")}.` : ". No alert recipients are configured, so nobody is emailed."}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AiBudgetForm initial={budgetRaw} effectivePlaceholder={effectivePlaceholder} />
          <AiBudgetRecipientsForm initial={recipientsRaw} />
        </div>
      </section>

      {/* Window switch */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-ink">Usage report</h2>
        <nav className="flex gap-1 text-xs" aria-label="Report window">
          {REPORT_DAYS.map((d) => (
            <Link
              key={d}
              href={`/admin/ai-telemetry?days=${d}`}
              className={`rounded-md border px-2.5 py-1 ${d === days ? "border-navy bg-navy text-white" : "border-border text-ink-muted hover:text-ink"}`}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      {/* Totals */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Calls" value={String(report.totals.calls)} />
        <Tile label="Cost" value={usd(report.totals.costUsd)} />
        <Tile label="Avg latency" value={ms(report.totals.avgLatencyMs)} />
        <Tile label="Success rate" value={pct(report.totals.okRate)} />
        <Tile label="Fallback rate" value={pct(report.totals.fallbackRate)} />
        <Tile label="Acceptance" value={pct(report.totals.acceptanceRate)} sub="accepted vs dismissed" />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {/* By feature */}
        <Card title="By feature" sub="Every AI job, sorted by cost. Fallbacks include budget refusals; errors include timeouts and rate limits." count={report.byFeature.length}>
          {report.byFeature.length > 0 && (
            <Table
              headers={["Module", "Feature", "Calls", "Cost", "Avg latency", "Success", "Fallbacks", "Errors", "Accepted", "Dismissed", "Edited"]}
              rows={report.byFeature.map((f) => [
                f.module,
                f.feature,
                String(f.calls),
                usd(f.costUsd),
                ms(f.avgLatencyMs),
                pct(f.okRate),
                String(f.fallbackCount),
                String(f.errorCount),
                String(f.accepted),
                String(f.dismissed),
                String(f.edited),
              ])}
            />
          )}
        </Card>

        {/* Top users */}
        <Card title="Top users by cost" sub="Signed-in users only. System jobs and public token flows are not attributed to a person." count={report.byUser.length}>
          {report.byUser.length > 0 && (
            <Table
              headers={["User", "Email", "Calls", "Cost"]}
              rows={report.byUser.map((u) => [u.name ?? u.userId, u.email ?? "(no account)", String(u.calls), usd(u.costUsd)])}
            />
          )}
        </Card>

        {/* By day */}
        <Card title="By day" sub="UTC days with at least one invocation." count={report.byDay.length}>
          {report.byDay.length > 0 && <DayBars rows={report.byDay} />}
        </Card>

        {/* Recent */}
        <Card title="Recent invocations" sub="Newest first, last 50 in the window." count={report.recent.length}>
          {report.recent.length > 0 && (
            <Table
              headers={["When", "Module", "Feature", "Model", "Latency", "Cost", "Outcome", "Acceptance"]}
              rows={report.recent.map((r) => [
                when(r.occurredAt),
                r.module,
                r.feature,
                r.model,
                ms(r.latencyMs),
                r.costUsd == null ? "" : usd(r.costUsd),
                r.errorClass ? `${r.outcome} (${r.errorClass})` : r.outcome,
                r.acceptance ?? "",
              ])}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</p>
      {sub && <p className="text-[11px] text-ink-faint">{sub}</p>}
    </div>
  );
}

function Card({ title, sub, count, children }: { title: string; sub: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        <span className="text-xs tabular-nums text-ink-muted">{count === 0 ? "no data in window" : `${count} rows`}</span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{sub}</p>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap py-1.5 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {cells.map((c, j) => (
                <td key={j} className={`whitespace-nowrap py-1.5 pr-4 ${j === 0 ? "text-ink" : "tabular-nums text-ink-muted"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayBars({ rows }: { rows: Array<{ day: string; calls: number; costUsd: number }> }) {
  const max = Math.max(...rows.map((r) => r.costUsd), 0.000001);
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.day} className="grid grid-cols-[92px_1fr_140px] items-center gap-3 text-xs">
          <span className="font-mono text-ink-muted">{r.day}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-navy" style={{ width: `${Math.max(2, Math.round((r.costUsd / max) * 100))}%` }} />
          </span>
          <span className="tabular-nums text-ink">
            {usd(r.costUsd)} <span className="text-ink-muted">· {r.calls} calls</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
