import Link from "next/link";
import { VALUE_CREATION as VC, Q2_BOARD } from "@/lib/sources";
import { FileText, Download, ExternalLink } from "@/components/icons";
import { PAGE_FRAME, PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Strategy Sources — Awayday" };

// Slides exported from the board decks. They are 900×506 images, so they're
// shown no wider than that (upscaling blurs the slide text).
const BOARD_DECKS = [
  {
    src: "/board-house.jpg",
    title: "Value Creation Strategy (the “house”)",
    asOf: "10 Apr 2026",
    caption: "Mission: To Perfect the Vacation Rental Experience · Objective: $150M EBITDA by 12/31/27 · Guest CSAT >4.65.",
    download: "awayday_value_creation_house.jpg",
  },
  {
    src: "/board-goals.jpg",
    title: "2026 Goals: the bright future",
    asOf: "10 Apr 2026",
    caption: "The three pillars enabling the year: Strongest Team · Empowering smarter decisions through technology · Building a Culture of Service.",
    download: "awayday_2026_goals.jpg",
  },
  {
    src: "/board-cim-matrix.jpg",
    title: "CIM Backwards risk matrix",
    asOf: "10 Apr 2026",
    caption: "Near-term focus on talent and revenue management / marketing to lower risk.",
    download: "awayday_cim_backwards.jpg",
  },
];

function AsOf({ date }: { date: string }) {
  return <Badge variant="secondary" className="tabular shrink-0 font-normal">As of {date}</Badge>;
}

export default function SourcesPage() {
  return (
    <div className={PAGE_FRAME}>
      <PageHeader
        title="Strategy Sources"
        description={
          <>
            The documents everything ladders to: the Value Creation house, the board commitments and the source
            financials. These are dated snapshots; live progress is on the{" "}
            <Link href="/" className="font-medium text-navy hover:underline">Strategy Review</Link>.
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Board-deck slides */}
        <section aria-label="Board deck slides" className="grid max-w-[900px] gap-5">
          {BOARD_DECKS.map((b) => (
            <figure key={b.src} className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">{b.title}</h2>
                <AsOf date={b.asOf} />
              </div>
              {/* Static slide exports: a plain <img> with intrinsic size keeps layout stable. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.src} alt={b.title} width={900} height={506} loading="lazy" decoding="async" className="block h-auto w-full" />
              <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-xs leading-5 text-ink-muted">
                <span className="min-w-0 flex-1">{b.caption}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Button asChild variant="ghost" size="sm">
                    <a href={b.src} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={13} aria-hidden /> Full size
                    </a>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <a href={b.src} download={b.download}>
                      <Download size={13} aria-hidden /> Download
                    </a>
                  </Button>
                </span>
              </figcaption>
            </figure>
          ))}
        </section>

        <div className="grid gap-5">
          {/* Value Creation "house" in text form */}
          <section className="grid gap-4 rounded-md border border-border bg-surface px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Value Creation Strategy</h2>
              <AsOf date="10 Apr 2026" />
            </div>
            <dl className="grid gap-3">
              <div className="rounded-md bg-surface-2 px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Mission</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{VC.mission}</dd>
              </div>
              <div className="rounded-md bg-surface-2 px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Objective</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{VC.objective}</dd>
              </div>
            </dl>
            <ChipGroup label="5 value drivers">
              {VC.valueDrivers.map((d) => <Badge key={d}>{d}</Badge>)}
            </ChipGroup>
            <ChipGroup label="Key enablers">
              {VC.keyEnablers.map((e) => <Badge key={e} variant="secondary" className="text-ink">{e}</Badge>)}
            </ChipGroup>
            <ChipGroup label="Values">
              {VC.values.map((v) => <Badge key={v} variant="custom" className="border border-gold/50 bg-gold/10 text-ink">{v}</Badge>)}
            </ChipGroup>
          </section>

          {/* Q2 board commitments */}
          <section className="rounded-md border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-ink">Q2 2026 Board Commitments</h2>
                <p className="mt-0.5 text-xs text-ink-muted">The five quarterly bets for Q2 2026 (ended 30 Jun 2026).</p>
              </div>
            </div>
            <ol className="divide-y divide-border">
              {Q2_BOARD.map((b, idx) => (
                <li key={b.id} className="flex gap-3 px-4 py-3 sm:px-5">
                  <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-navy/10 text-xs font-semibold text-navy-deep">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{b.name} <span className="font-normal text-ink-faint">· {b.owner}</span></p>
                    <p className="mt-0.5 text-xs leading-5 text-ink-muted">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Source documents */}
          <section className="rounded-md border border-border bg-surface px-4 py-4 sm:px-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Source documents</h2>
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-navy/10 text-navy-deep">
                <FileText size={16} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  National Financial Review <AsOf date="Mar 2026" />
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  The 193-page monthly financial deep-dive behind the EBITDA build, scorecard and goals (MTD and YTD P&amp;L,
                  LTM PF EBITDA breakouts, region and brand performance). Held in the project folder.
                </p>
                <p className="mt-2 text-[11px] text-ink-faint">Headline figures at March 2026:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="tabular font-normal">EBITDA $108.8M</Badge>
                  <Badge variant="outline" className="tabular font-normal">+$22.4M YTD</Badge>
                  <Badge variant="outline" className="tabular font-normal">28.9% LTM gross adds</Badge>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
