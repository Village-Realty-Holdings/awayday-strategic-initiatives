import { EBITDA_BUILD } from "@/lib/sources";
import type { EbitdaBuild as EbitdaBuildData } from "@/lib/overview-data";

const fmt = (n: number) => `$${n.toFixed(1)}M`;
const fmt0 = (n: number) => `$${n.toFixed(0)}M`;

export function EbitdaBuild({ data = EBITDA_BUILD }: { data?: EbitdaBuildData }) {
  const E = data;
  const max = E.target2027;
  const pct = (v: number) => `${Math.min((v / max) * 100, 100)}%`;
  const gap2026 = E.target2026 - E.lender;
  const gap2027 = E.target2027 - E.lender;
  const trendMax = Math.max(...E.trend.map((t) => t.v));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      {/* Progress + key figures */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <p className="text-xs font-medium text-ink-faint">LTM Pro Forma Lender EBITDA · {E.asOf}</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="tabular text-3xl font-semibold tracking-tight text-ink">{fmt(E.lender)}</span>
          <span className="text-sm text-ink-muted">building to {fmt0(E.target2027)} by 12/31/27</span>
        </p>

        {/* Rail with the two targets */}
        <div className="relative mt-5 h-2.5 w-full rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-navy" style={{ width: pct(E.lender) }} />
          <span className="absolute -top-1 bottom-[-4px] w-px bg-ink-faint" style={{ left: pct(E.target2026) }} title="2026 goal" />
        </div>
        <div className="tabular mt-1.5 flex justify-between text-[10px] text-ink-faint">
          <span>$0M</span>
          <span className="font-semibold text-navy">{fmt(E.lender)} now</span>
          <span style={{ marginRight: "8%" }}>{fmt0(E.target2026)} (12/26)</span>
          <span>{fmt0(E.target2027)}</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-3">
          <Row label="Lender EBITDA" value={fmt(E.lender)} strong />
          <Row label="Valuation EBITDA" value={fmt(E.valuation)} />
          <Row label="YTD growth" value={`+${fmt(E.ytdGrowth)}`} tone="ok" />
          <Row label="Gap to 2026 ($126M)" value={fmt(gap2026)} />
          <Row label="Gap to 2027 ($150M)" value={fmt(gap2027)} />
          {"netLeverage" in E && <Row label="Net leverage" value={`${(E as { netLeverage: number }).netLeverage.toFixed(2)}x`} />}
          {"units" in E && <Row label="Units" value={(E as { units: number }).units.toLocaleString()} />}
          {"ttmChurn" in E && <Row label="TTM owner churn" value={`${(E as { ttmChurn: number }).ttmChurn}%`} />}
        </div>

        {/* Trend sparkline */}
        <div className="mt-5">
          <p className="mb-1.5 text-[11px] font-medium text-ink-faint">LTM Lender EBITDA trend</p>
          <div className="flex items-end gap-2">
            {E.trend.map((t) => (
              <div key={t.m} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-12 w-full items-end">
                  <div
                    className="w-full rounded-sm bg-navy/70"
                    style={{ height: `${Math.max((t.v / trendMax) * 100, 6)}%` }}
                    title={`${t.m}: ${fmt(t.v)}`}
                  />
                </div>
                <span className="text-[10px] text-ink-faint">{t.m}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The bridge */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">How {fmt(E.lender)} builds</h3>
        <table className="w-full text-sm">
          <tbody>
            {E.bridge.map((b) => (
              <tr
                key={b.label}
                className={b.subtotal || b.total ? "border-t border-border" : ""}
              >
                <td
                  className={`py-1.5 ${b.total ? "font-semibold text-ink" : b.subtotal ? "font-medium text-navy-deep" : "pl-3 text-ink-muted"}`}
                >
                  {b.label}
                </td>
                <td
                  className={`tabular py-1.5 text-right ${b.total ? "font-semibold text-navy" : b.subtotal ? "font-medium text-navy-deep" : "text-ink"}`}
                >
                  {fmt(b.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          <span className="font-medium text-ink-muted">The story:</span> YTD growth driven by M&amp;A
          (Beach-Head + Fill-In + tuck-ins), partly offset by intentional BD + SupportCo investment to
          fuel further growth.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "ok" }) {
  return (
    <div className="flex flex-col">
      <span className={`tabular ${strong ? "text-base font-semibold" : "text-sm font-medium"} ${tone === "ok" ? "text-ok" : "text-ink"}`}>
        {value}
      </span>
      <span className="text-[11px] text-ink-faint">{label}</span>
    </div>
  );
}
