import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, Database, FileText, Inbox, ListTree, UserCheck, Users } from "lucide-react";
import { requireApp } from "@/lib/session";
import { MockNote, V2Header } from "./_components/preview";
import { LATEST_PERIOD } from "./_mock/selectors";

const SECTIONS = [
  { href: "/v2/review", icon: FileText, title: "Strategy Review", body: "The monthly ELT page: read-this-first banner, pillar scorecard, so-whats, LTM EBITDA and TRevPAR charts, M&A detail, region and brand tables, guest floor tracking, enabler measures, one card per SI, next 60 days, asks and sources. Month switcher and mock Publish for editors." },
  { href: `/v2/review/${LATEST_PERIOD.id}/edit`, icon: ClipboardCheck, title: "Review authoring", body: "Edit the summary and per-pillar so-whats, set each pillar's status label and commentary, see which SIs have submitted, and publish (mock)." },
  { href: "/v2/my", icon: UserCheck, title: "My SIs this month", body: "Each owner's monthly update form: status, latest progress, what next. Deadline banner, locked after publish, tick off milestones and action items." },
  { href: "/v2/timeline", icon: CalendarDays, title: "Timeline", body: "Next 60 days of milestones across SIs and non-SI items, grouped by date, with past-due items flagged and filters by pillar and owner." },
  { href: "/v2/inbox", icon: Inbox, title: "Inbox", body: "Personal view: SIs needing an update, open milestones and action items, and ELT asks on my SIs." },
  { href: "/v2/asks", icon: Users, title: "Asks by leader", body: "For each leader, their SIs with this month's update state and open items. Group by ELT owner (default) or by SI lead." },
  { href: "/v2/below-the-line", icon: ListTree, title: "Below the line", body: "Per function, the smaller projects junior teams run that feed the SIs, each linked to its SI with an owner and status. Projects are invented for the mock." },
  { href: "/v2/definitions", icon: BookOpen, title: "Metric definitions", body: "Register of the two TRevPAR bases, two margin bases, three churn views, derived organic adds, the EBITDA frame conflict, unit base and what is not measured monthly." },
  { href: "/v2/data", icon: Database, title: "Data inputs", body: "Admin view of the monthly sources (Finance Flash, Shop Ranking, National Financial Review, M&A update, AwayDNA) with last-loaded dates and a mock load control." },
];

export default async function V2IndexPage() {
  await requireApp("initiatives");
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <V2Header
        eyebrow="V2 preview"
        title="Monthly Strategy Review tool"
        description="A clickable mock of the planned monthly ELT Strategy Review and the owner workflow behind it. Everything here uses static September 2026 data and the 26 FY27 SIs; nothing is read from or written to the database."
      />

      <section className="rounded-xl border border-navy/20 bg-navy px-6 py-5 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">How it fits together</p>
        <ol className="mt-2 grid gap-3 text-sm text-white/80 md:grid-cols-3">
          <li><span className="font-semibold text-white">1. Owners update.</span> Each SI owner submits status, latest progress and what next before the deadline (My SIs).</li>
          <li><span className="font-semibold text-white">2. Strategy curates.</span> Strategy writes the so-whats and pillar status, watches submissions and publishes (Review authoring).</li>
          <li><span className="font-semibold text-white">3. ELT discusses.</span> The published Strategy Review is the page the ELT reads, with milestones and asks attached.</li>
        </ol>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Sections</h2>
          <MockNote>Mock — forms do not save</MockNote>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.title} href={s.href} className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-navy/40">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy/10 text-navy-deep">
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="text-base font-semibold text-ink group-hover:text-navy-deep">{s.title}</h3>
                <p className="text-sm leading-5 text-ink-muted">{s.body}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-navy">
                  Open <ArrowRight size={12} aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">
        <h2 className="text-sm font-semibold text-ink">About the mock data</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-4">
          <li>September 2026 numbers, pillars, owners, so-whats and milestones come from the September Strategy Review MVP. Where the MVP lacks data (monthly LTM EBITDA and TRevPAR shapes, the split of the three tuck-ins, below-the-line projects, data load dates) the figures are invented and labelled mock.</li>
          <li>SIs are the FY27 plan SIs. Monthly updates (a mix of submitted, draft and not submitted) are invented for the preview. August 2026 is an invented second month for the switcher.</li>
          <li>The personal pages (My SIs, Inbox) pretend you are Kyle Sullivan, who leads several SIs. Dates use a fixed &ldquo;today&rdquo; of 14 Oct 2026.</li>
          <li>Existing pages are unchanged; this preview lives only under <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">/v2</code>.</li>
        </ul>
      </section>
    </div>
  );
}
