import { VALUE_CREATION as VC, Q2_BOARD } from "@/lib/sources";
import { FileText, Download } from "lucide-react";

export const metadata = { title: "Strategy Sources — Awayday" };

const BOARD_DECKS = [
  {
    src: "/board-house.jpg",
    title: "Value Creation Strategy (the “house”)",
    caption: "Source: 4/10/26 board deck. Mission: To Perfect the Vacation Rental Experience · Objective: $150M EBITDA by 12/31/27 · Guest CSAT >4.65.",
  },
  {
    src: "/board-goals.jpg",
    title: "2026 Goals — the bright future",
    caption: "The three pillars enabling the year: Strongest Team · Empowering smarter decisions through technology · Building a Culture of Service.",
  },
  {
    src: "/board-cim-matrix.jpg",
    title: "CIM Backwards risk matrix",
    caption: "Source: 4/10/26 board deck. Near-term focus on talent and revenue management / marketing to lower risk.",
    download: "awayday_cim_backwards.jpg",
  },
];

export default function SourcesPage() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Strategy Sources</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The strategic frame everything ladders to: the Value Creation house, the quarter&apos;s board
          commitments, and the source financials. (Live goals &amp; scorecard are on the Overview.)
        </p>
      </div>

      {/* Board-deck slides */}
      <section className="flex flex-col gap-5">
        {BOARD_DECKS.map((b) => (
          <figure key={b.src} className="overflow-hidden rounded-xl border border-border bg-surface">
            <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-ink">{b.title}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.src} alt={b.title} className="block w-full" />
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-gold/50 bg-gold/5 px-4 py-2.5 text-xs text-ink-muted">
              <span>{b.caption}</span>
              {b.download && (
                <a
                  href={b.src}
                  download={b.download}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 font-medium text-navy-deep transition-colors hover:bg-surface-2"
                >
                  <Download size={13} aria-hidden /> Download
                </a>
              )}
            </figcaption>
          </figure>
        ))}
      </section>

      {/* Value Creation "house" */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Value Creation Strategy</h2>
          <span className="text-[11px] text-ink-faint">Source: {VC.source}</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-2/50 p-4">
            <p className="text-[11px] font-medium text-ink-faint">Mission</p>
            <p className="mt-1 text-sm font-medium text-ink">{VC.mission}</p>
          </div>
          <div className="rounded-lg bg-surface-2/50 p-4">
            <p className="text-[11px] font-medium text-ink-faint">Objective</p>
            <p className="mt-1 text-sm font-medium text-ink">{VC.objective}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-medium text-ink-faint">5 Value Drivers</p>
          <div className="flex flex-wrap gap-2">
            {VC.valueDrivers.map((d) => (
              <span key={d} className="rounded-md bg-navy/10 px-2.5 py-1 text-xs font-medium text-navy-deep">{d}</span>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-ink-faint">Key Enablers</p>
            <div className="flex flex-wrap gap-2">
              {VC.keyEnablers.map((e) => (
                <span key={e} className="rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink">{e}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-ink-faint">Values</p>
            <div className="flex flex-wrap gap-2">
              {VC.values.map((v) => (
                <span key={v} className="rounded-md border border-gold/50 bg-gold/10 px-2.5 py-1 text-xs font-medium text-ink">{v}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Q2 board commitments */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink">Q2 2026 Board Commitments</h2>
        <p className="mb-3 text-xs text-ink-faint">The five quarterly bets from the Q2 board meeting (now → 6/30/2026). Live progress is on the Overview.</p>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {Q2_BOARD.map((b, idx) => (
            <div key={b.id} className={`flex gap-4 px-4 py-3.5 ${idx > 0 ? "border-t border-border/60" : ""}`}>
              <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy/10 text-xs font-semibold text-navy-deep">
                {idx + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{b.name} <span className="font-normal text-ink-faint">· {b.owner}</span></p>
                <p className="mt-0.5 text-sm text-ink-muted">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Source documents */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Source documents</h2>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
          <FileText size={18} className="mt-0.5 shrink-0 text-navy" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink">National Financial Review — March 2026</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              The 193-page monthly financial deep-dive that drives the EBITDA build, scorecard, and
              goals (MTD &amp; YTD P&amp;L, LTM PF EBITDA breakouts, region/brand performance). Held in the
              project folder.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="tabular rounded bg-surface-2 px-2 py-0.5 text-ink-muted">EBITDA $108.8M</span>
              <span className="tabular rounded bg-surface-2 px-2 py-0.5 text-ink-muted">+$22.4M YTD</span>
              <span className="tabular rounded bg-surface-2 px-2 py-0.5 text-ink-muted">28.9% LTM gross adds</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
