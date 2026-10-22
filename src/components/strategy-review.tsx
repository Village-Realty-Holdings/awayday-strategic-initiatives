"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BarChart,
  Building,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Handshake,
  House,
  ListBullets,
  MessageQuestion,
  Note,
  Percent,
  Target,
  TrendingUp,
  UserHeart,
  X,
  type AppIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type DataColumn, type DataRow } from "@/app/(app)/v2/_components/data-table";
import { TONE_VARIANT } from "@/app/(app)/v2/_components/status";
import {
  type ReviewInitiative,
  type ReviewPillar,
  type ReviewSnapshot,
  type ReviewTone,
} from "@/lib/strategy-review-data";

// Review tone -> shared status badge variant (good=ahead, warn=watch, risk=behind).
const toneVariant: Record<ReviewTone, "ok" | "default" | "warn" | "risk" | "outline"> = {
  good: TONE_VARIANT.ahead,
  warn: TONE_VARIANT.watch,
  risk: TONE_VARIANT.behind,
  neutral: "outline",
};

const toneLabel: Record<ReviewTone, string> = {
  good: "On track",
  warn: "Watch",
  risk: "Behind",
  neutral: "TBD",
};

// Compact card geometry shared by the review's panels (Card defaults are roomier).
const CARD = "gap-3 rounded-md py-4";
const PAD = "px-4";

function StatusBadge({ tone, children }: { tone: ReviewTone; children?: React.ReactNode }) {
  return (
    <Badge variant={toneVariant[tone]} shape="pill" className="gap-1.5 uppercase tracking-[0.08em]">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children ?? toneLabel[tone]}
    </Badge>
  );
}

function SectionIcon({ icon: Icon, size = "md" }: { icon: AppIcon; size?: "sm" | "md" }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-md bg-navy/10 text-navy-deep ${size === "sm" ? "size-6" : "size-8"}`}>
      <Icon size={size === "sm" ? 14 : 17} />
    </span>
  );
}

function SectionHeader({ id, title, owner, tone, icon }: { id: string; title: string; owner?: string; tone?: ReviewTone; icon?: AppIcon }) {
  return (
    <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      {icon && <SectionIcon icon={icon} />}
      <h2 id={id} className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      {owner && <span className="text-xs text-ink-muted">{owner}</span>}
      {tone && <StatusBadge tone={tone}>{houseLabel(tone)}</StatusBadge>}
    </header>
  );
}

function cellTone(cell: string, index: number) {
  if (index > 0 && /[−-]/.test(cell)) return "text-risk";
  if (/[+]/.test(cell)) return "text-ok";
  return undefined;
}

// Review tables are arrays of strings; adapt them to the shared v2 DataTable.
function ReviewTable({ headers, rows, caption }: { headers: string[]; rows: readonly (readonly string[])[]; caption: string }) {
  const columns: DataColumn[] = headers.map((label, index) => ({ key: `c${index}`, label, numeric: index > 0 }));
  const dataRows: DataRow[] = rows.map((row) => ({
    id: row[0],
    cells: Object.fromEntries(row.map((cell, index) => [`c${index}`, <span key={index} className={cellTone(cell, index)}>{cell}</span>])),
  }));
  return <DataTable columns={columns} rows={dataRows} minWidth="620px" caption={caption} />;
}

function Gauge({ tone, value, target }: { tone: ReviewTone; value: number; target: number }) {
  const width = Math.max(8, Math.min(96, (value / 50) * 100));
  const targetLeft = Math.max(6, Math.min(94, (target / 50) * 100));
  return (
    <div className="relative h-12">
      <div className="absolute inset-x-0 top-5 h-2 rounded-full bg-surface-2" />
      <div className={`absolute left-0 top-5 h-2 rounded-full ${tone === "risk" ? "bg-risk" : tone === "warn" ? "bg-warn" : "bg-navy"}`} style={{ width: `${width}%` }} />
      <span className="absolute top-3 h-6 w-0.5 bg-ink" style={{ left: `${targetLeft}%` }} aria-hidden />
      <span className={`absolute top-3 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-surface ${tone === "risk" ? "bg-risk" : tone === "warn" ? "bg-warn" : "bg-navy"}`} style={{ left: `${width}%` }} aria-label={`Current value ${value}`} />
      <span className="absolute top-0 -translate-x-1/2 text-[10px] text-ink-muted" style={{ left: `${targetLeft}%` }}>goal</span>
      <span className="absolute bottom-0 left-0 text-[10px] text-ink-faint">0</span>
      <span className="absolute bottom-0 right-0 text-[10px] text-ink-faint">50</span>
    </div>
  );
}

function InitiativeCard({ initiative, onOpen }: { initiative: ReviewInitiative; onOpen: (initiative: ReviewInitiative) => void }) {
  // The "Open charter" button is the single tab stop; its ::after stretches
  // over the whole card so the entire card is clickable. The button must not
  // move on press: a transform makes it the ::after's containing block, the
  // overlay collapses to the button mid-click and the click is lost. The card
  // takes the press feedback instead.
  return (
    <Card className={`${CARD} group relative gap-2 border-l-4 border-l-navy transition hover:border-navy hover:shadow-sm has-[button:active]:translate-y-px has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold`}>
      <CardHeader className={`${PAD} grid-cols-[1fr_auto]`}>
        <div className="min-w-0">
          <span className="tabular block text-[10px] text-ink-faint">{initiative.code}</span>
          <CardTitle className="mt-1 text-base group-hover:text-navy-deep">{initiative.name}</CardTitle>
        </div>
        <StatusBadge tone={initiative.status} />
      </CardHeader>
      <CardContent className={`${PAD} grid gap-2`}>
        <span className="text-xs leading-5 text-ink-muted">{initiative.what}</span>
        <span className="border-t border-dashed border-border pt-2 text-xs text-ink-muted"><b className="font-semibold text-ink">Goal:</b> {initiative.goal}</span>
        {initiative.latestUpdate && <span className="text-[11px] leading-4 text-ink-faint"><b className="font-semibold text-ink-muted">Latest update:</b> {initiative.latestUpdate}</span>}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() => onOpen(initiative)}
            className="font-semibold text-navy-deep after:absolute after:inset-0 after:content-[''] hover:no-underline active:translate-none"
          >
            Open charter <ArrowUpRight size={13} aria-hidden />
            <span className="sr-only"> for {initiative.name}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CharterLabel({ icon: Icon, children }: { icon: AppIcon; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
      <Icon size={13} aria-hidden />
      {children}
    </p>
  );
}

/** Milestones arrive as "Title · 30 Oct 2026"; split them and find the next one still ahead. */
function charterMilestones(milestones: string[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = milestones.map((milestone) => {
    const [title, date] = milestone.split(" · ");
    const time = date ? Date.parse(date) : NaN;
    return { key: milestone, title, date, past: !Number.isNaN(time) && time < today.getTime() };
  });
  const nextIndex = rows.findIndex((row) => row.date && !row.past);
  return rows.map((row, index) => ({ ...row, next: index === nextIndex }));
}

// The charter dialog: who owns it, what it is and is going for, the dated
// milestone path, and any ask of the ELT. Previous/Next walk the pillar's
// initiatives so a review can go through them without closing the dialog.
function CharterBody({
  initiative,
  siblings,
  recordId,
  onNavigate,
}: {
  initiative: ReviewInitiative;
  siblings: ReviewInitiative[];
  recordId?: string;
  onNavigate: (initiative: ReviewInitiative) => void;
}) {
  const index = Math.max(0, siblings.findIndex((item) => item.code === initiative.code));
  const prev = siblings[index - 1];
  const next = siblings[index + 1];
  const milestones = charterMilestones(initiative.milestones);
  return (
    <>
      <DialogHeader className="gap-3 border-b border-border px-6 pb-5 pt-5 pr-14">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="tabular text-[10px] text-ink-faint">{initiative.code}</span>
          <span className="h-3 w-px bg-border" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{initiative.pillar}</span>
          <StatusBadge tone={initiative.status} />
        </div>
        <DialogTitle className="text-xl leading-7 tracking-tight">{initiative.name}</DialogTitle>
        <DialogDescription asChild>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div className="flex gap-1.5"><dt className="text-ink-faint">Sponsor</dt><dd className="font-medium text-ink">{initiative.sponsor}</dd></div>
            <div className="flex gap-1.5"><dt className="text-ink-faint">Owner</dt><dd className="font-medium text-ink">{initiative.owner}</dd></div>
          </dl>
        </DialogDescription>
      </DialogHeader>
      <DialogClose asChild>
        <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 h-8 w-8 p-0" aria-label="Close charter"><X size={17} aria-hidden /></Button>
      </DialogClose>

      <div className="grid min-h-0 gap-6 overflow-y-auto px-6 py-5 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <CharterLabel icon={Note}>What it is</CharterLabel>
            <p className="leading-6 text-ink">{initiative.what}</p>
          </div>
          <div className="grid content-start gap-1.5 rounded-md bg-surface-2 p-3">
            <CharterLabel icon={Target}>What it is going for</CharterLabel>
            <p className="leading-6 text-ink">{initiative.goal}</p>
          </div>
        </div>

        {initiative.latestUpdate && (
          <div className="grid gap-1.5">
            <CharterLabel icon={Clock}>Latest update</CharterLabel>
            <p className="leading-6 text-ink-muted">{initiative.latestUpdate}</p>
          </div>
        )}

        {milestones.length > 0 && (
          <div className="grid gap-2">
            <CharterLabel icon={Flag}>Milestones</CharterLabel>
            <ol className="grid">
              {milestones.map((milestone, i) => (
                <li key={milestone.key} className="relative grid grid-cols-[1rem_6.5rem_1fr] items-baseline gap-x-2 pb-3 last:pb-0">
                  {i < milestones.length - 1 && <span className="absolute bottom-0 left-[0.4375rem] top-3 w-px bg-border" aria-hidden />}
                  <span
                    aria-hidden
                    className={`relative top-px size-2 justify-self-center rounded-full ${
                      milestone.next ? "bg-navy ring-4 ring-navy/15" : milestone.past ? "bg-ink-faint" : "border border-ink-faint bg-surface"
                    }`}
                  />
                  <span className={`tabular text-xs ${milestone.past ? "text-ink-faint" : "text-ink-muted"}`}>{milestone.date ?? "TBD"}</span>
                  <span className={`flex flex-wrap items-center gap-2 text-xs ${milestone.past ? "text-ink-muted" : "text-ink"} ${milestone.next ? "font-semibold" : ""}`}>
                    {milestone.title}
                    {milestone.next && <Badge>Next</Badge>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {initiative.ask && (
          <div className="grid gap-1.5 rounded-md border border-navy/20 bg-navy/5 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-navy-deep">
              <MessageQuestion size={13} aria-hidden />
              Ask of the ELT
            </p>
            <p className="leading-6 text-ink">{initiative.ask}</p>
          </div>
        )}
      </div>

      <DialogFooter className="items-center gap-3 border-t border-border bg-surface-2/50 px-6 py-3 sm:justify-between">
        {siblings.length > 1 ? (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={!prev} onClick={() => prev && onNavigate(prev)} aria-label={prev ? `Previous initiative: ${prev.name}` : "Previous initiative"}>
              <ChevronLeft size={14} aria-hidden /> Previous
            </Button>
            <span className="tabular px-1 text-[11px] text-ink-faint">{index + 1} of {siblings.length}</span>
            <Button type="button" variant="ghost" size="sm" disabled={!next} onClick={() => next && onNavigate(next)} aria-label={next ? `Next initiative: ${next.name}` : "Next initiative"}>
              Next <ChevronRight size={14} aria-hidden />
            </Button>
          </div>
        ) : <span />}
        <div className="flex items-center gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">Back to review</Button>
          </DialogClose>
          {recordId && (
            <Button asChild size="sm">
              <a href={`/initiatives/${recordId}`}>Open full record <ArrowUpRight size={13} aria-hidden /></a>
            </Button>
          )}
        </div>
      </DialogFooter>
    </>
  );
}

// Page sections in order, for the section bar (title, icon, one-line note)
// and the section headings. Pillars are added from the review data.
type ReviewSection = { id: string; label: string; title: string; note?: string; icon: AppIcon; pillar?: ReviewPillar };
const OVERVIEW: ReviewSection = { id: "overview", label: "Overview", title: "Strategy house", note: "Mission, the five pillars and where each stands", icon: House };
const SUMMARY: ReviewSection = { id: "summary", label: "Summary", title: "Summary", note: "Four things to take from September", icon: Note };
const FINANCIALS: ReviewSection = { id: "financials", label: "Financials", title: "September financials", note: "Base business · Finance Flash Results, vFinal 12 Oct", icon: BarChart };
const MILESTONES: ReviewSection = { id: "milestones", label: "Milestones", title: "Upcoming milestones", note: "The next dates that change the conversation", icon: Flag };
const ASKS: ReviewSection = { id: "asks", label: "Asks", title: "Asks by leader", note: "Decisions and unblockers for the ELT meeting", icon: MessageQuestion };
const PILLAR_ICON: Record<string, AppIcon> = { ma: Handshake, units: Building, retention: UserHeart, trevpar: TrendingUp, margin: Percent };

/** Top-border colour for a pillar's status, shared by the house and its compact copy. */
function toneBorder(tone: ReviewTone): string {
  return tone === "risk" ? "border-t-risk" : tone === "warn" ? "border-t-warn" : "border-t-ok";
}

function toneDot(tone: ReviewTone): string {
  return tone === "risk" ? "bg-risk" : tone === "warn" ? "bg-warn" : "bg-ok";
}

/** The house's wording for a pillar's status (it reads differently from toneLabel). */
function houseLabel(tone: ReviewTone): string {
  return tone === "risk" ? "Behind" : tone === "warn" ? "On goal / watch" : "Ahead";
}


export function StrategyReview({ snapshot }: { snapshot: ReviewSnapshot }) {
  const { meta, pillars, summaryTiles, financeRows, kpiRows, ebitdaTrend, initiativeLinks } = snapshot;
  // `selected` is kept after close so the dialog's exit animation still has
  // content; `charterOpen` alone drives visibility.
  const [selected, setSelected] = useState<ReviewInitiative | null>(null);
  const [charterOpen, setCharterOpen] = useState(false);
  const linkMap = useMemo(() => new Map(initiativeLinks.map((item) => [item.code, item.id])), [initiativeLinks]);

  // Sticky title: a 1px sentinel just above it scrolls out of the content card
  // exactly when the title pins, which switches it to its compact style.
  const titleSentinel = useRef<HTMLDivElement>(null);
  const [titleStuck, setTitleStuck] = useState(false);
  useEffect(() => {
    const el = titleSentinel.current;
    const root = document.querySelector<HTMLElement>(".app-inset");
    if (!el || !root) return;
    const io = new IntersectionObserver(([entry]) => setTitleStuck(!entry.isIntersecting), { root });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Section bar: once the title pins, a row under it names the section in
  // view (scroll-spy) and offers a Sections menu and a Next button.
  const stickyRef = useRef<HTMLDivElement>(null);
  const sections = useMemo<ReviewSection[]>(
    () => [
      OVERVIEW,
      SUMMARY,
      FINANCIALS,
      ...pillars.map((pillar) => ({
        id: pillar.id,
        label: pillar.name,
        title: `Pillar ${pillar.number} · ${pillar.name}`,
        note: pillar.owner,
        icon: PILLAR_ICON[pillar.id] ?? Target,
        pillar,
      })),
      MILESTONES,
      ASKS,
    ],
    [pillars],
  );
  const [activeId, setActiveId] = useState(OVERVIEW.id);
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>(".app-inset");
    if (!panel) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const bar = stickyRef.current?.getBoundingClientRect();
      if (!bar) return;
      // A section is current once its heading area reaches the bar; sections
      // carry py-7, so allow for that padding below the bar.
      const line = bar.bottom + 48;
      let current = sections[0].id;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= line) current = section.id;
      }
      // At the very bottom the last short section can never reach the line.
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2) current = sections[sections.length - 1].id;
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    panel.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      panel.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);
  // Menu picks scroll once the menu has closed. Radix returns focus to the
  // trigger on close, and a plain focus() would cancel a smooth scroll, so we
  // take over that step: refocus without scrolling, then scroll. The hash is
  // recorded without a jump; the Next link uses native anchor scrolling.
  const sectionsTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingSection = useRef<string | null>(null);
  const onSectionsClosed = useCallback((e: Event) => {
    const id = pendingSection.current;
    if (!id) return;
    pendingSection.current = null;
    e.preventDefault();
    sectionsTriggerRef.current?.focus({ preventScroll: true });
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }, []);
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeId));
  const active = sections[activeIndex];
  const next = sections[activeIndex + 1];

  // Opening a charter writes #si-CODE (replaceState: no scroll jump, no extra
  // history entry); closing clears it, so a re-render can never reopen it.
  const openCharter = useCallback((initiative: ReviewInitiative) => {
    setSelected(initiative);
    setCharterOpen(true);
    window.history.replaceState(null, "", `#si-${initiative.code}`);
  }, []);
  const closeCharter = useCallback(() => {
    setCharterOpen(false);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // Deep link (#si-CODE) opens that initiative's charter. Runs on mount (read
  // after mount so the server and first client render agree) and on hashchange
  // (back/forward or a pasted link), never on ordinary re-renders.
  useEffect(() => {
    const initiatives = pillars.flatMap((pillar) => pillar.initiatives);
    const syncFromHash = () => {
      const { hash } = window.location;
      if (!hash.startsWith("#si-")) return;
      const match = initiatives.find((item) => item.code === hash.slice(4));
      if (match) {
        setSelected(match);
        setCharterOpen(true);
      }
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [pillars]);

  return (
    <div className="strategy-review mx-auto max-w-[1400px] text-sm">
      {/* The title is a direct child of the review so it stays pinned to the
          top of the content card for the whole page; it compacts once stuck. */}
      <span id="top" className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{meta.eyebrow}</span>
      <div ref={titleSentinel} aria-hidden className="h-px" />
      <div
        ref={stickyRef}
        className={`sticky top-0 z-20 -mx-6 px-6 transition-[padding,background-color,box-shadow] duration-200 ${
          titleStuck ? "border-b border-border bg-surface/95 py-2.5 shadow-[0_1px_8px_-4px_rgb(0_0_0/0.12)] backdrop-blur" : "py-1.5"
        }`}
      >
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            {/* Copies of the eyebrow and meta line ride along once pinned; the
                originals scroll away, so these are hidden from screen readers. */}
            {titleStuck && (
              <span aria-hidden className="block truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{meta.eyebrow}</span>
            )}
            <h1 className={`truncate font-semibold tracking-tight text-ink transition-[font-size,line-height] duration-200 ${titleStuck ? "text-lg leading-6" : "text-3xl"}`}>
              {meta.title}
            </h1>
          </div>
          {titleStuck && (
            <div aria-hidden className="hidden shrink-0 items-center gap-x-4 pb-0.5 text-[11px] text-ink-muted lg:flex">
              <span>Prepared by {meta.preparedBy}</span>
              <span className="h-3 w-px bg-border" />
              <span>{meta.asOf}</span>
              <span className="h-3 w-px bg-border" />
              <span className="max-w-72 truncate" title={meta.finance}>{meta.finance}</span>
            </div>
          )}
        </div>
        {titleStuck && (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/70 pt-2">
            {/* Current section: keyed so it eases in when the section changes. */}
            <div key={active.id} className="flex min-w-0 animate-in items-center gap-2.5 fade-in-0 slide-in-from-bottom-1 duration-200" aria-live="polite">
              <SectionIcon icon={active.icon} size="sm" />
              <span className="truncate text-sm font-semibold text-ink">{active.title}</span>
              {active.pillar ? (
                <>
                  <StatusBadge tone={active.pillar.status}>{houseLabel(active.pillar.status)}</StatusBadge>
                  <span className="tabular hidden text-sm font-semibold text-ink sm:inline">{active.pillar.actual}</span>
                  <span className="hidden truncate text-xs text-ink-muted xl:inline">{active.pillar.measure}</span>
                </>
              ) : (
                active.note && <span className="hidden truncate text-xs text-ink-muted md:inline">{active.note}</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="tabular hidden pr-1 text-[11px] text-ink-faint sm:inline" aria-hidden>
                {activeIndex + 1} / {sections.length}
              </span>
              {/* Non-modal: a modal menu locks scrolling while it closes, which
                  swallows the jump to the picked section. */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button ref={sectionsTriggerRef} variant="secondary" size="sm" className="gap-1.5">
                    <ListBullets size={14} aria-hidden />
                    Sections
                    <ChevronDown size={13} aria-hidden className="text-ink-faint" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72" onCloseAutoFocus={onSectionsClosed}>
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Jump to section</DropdownMenuLabel>
                  {sections.map((section, i) => {
                    const on = section.id === active.id;
                    const Icon = section.icon;
                    return (
                      <div key={section.id}>
                        {(i === 3 || i === 3 + pillars.length) && <DropdownMenuSeparator />}
                        {/* A plain item, not a link: Radix runs onSelect from the
                            click, and a native anchor jump would fight that scroll. */}
                        <DropdownMenuItem
                          onSelect={() => {
                            pendingSection.current = section.id;
                          }}
                          aria-current={on ? "location" : undefined}
                          className={`cursor-pointer gap-2.5 ${on ? "bg-navy/10" : ""}`}
                        >
                          <Icon size={15} aria-hidden className={on ? "text-navy-deep" : "text-ink-muted"} />
                          <span className={`min-w-0 flex-1 truncate ${on ? "font-semibold text-navy-deep" : "text-ink"}`}>
                            {section.pillar ? `${section.pillar.number} · ${section.label}` : section.label}
                          </span>
                          {section.pillar && (
                            <span className="flex shrink-0 items-center gap-1.5">
                              <span className="tabular text-xs text-ink-muted">{section.pillar.actual}</span>
                              <span className={`size-1.5 rounded-full ${toneDot(section.pillar.status)}`} aria-label={houseLabel(section.pillar.status)} role="img" />
                            </span>
                          )}
                          {on && <Check size={14} aria-hidden className="shrink-0 text-navy-deep" />}
                        </DropdownMenuItem>
                      </div>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {next ? (
                <Button asChild size="sm" className="gap-1.5">
                  <a href={`#${next.id}`}>
                    <span className="hidden text-white/70 md:inline">Next:</span>
                    <span className="max-w-40 truncate">{next.label}</span>
                    <ArrowDown size={14} aria-hidden />
                  </a>
                </Button>
              ) : (
                <Button asChild variant="secondary" size="sm" className="gap-1.5">
                  <a href="#top">
                    Back to top
                    <ArrowUp size={14} aria-hidden />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <header className="grid gap-2 pb-7">
        <p className="max-w-4xl text-sm leading-6 text-ink-muted">Where each pillar stands against the 2026 goal and FY27 target, the so-whats from September, and the strategic initiatives that need the ELT&apos;s attention.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted"><span>Prepared by {meta.preparedBy}</span><span>{meta.asOf}</span><span>{meta.finance}</span></div>
      </header>

      <section id="overview" aria-label="Strategy house" className="grid scroll-mt-28 gap-1 pb-7">
        <div className="bg-navy px-5 pb-3 pt-8 text-center text-white [clip-path:polygon(0_100%,50%_0,100%_100%)]">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Mission · To Perfect the Vacation Rental Experience</p>
          <p className="mt-1 text-lg font-semibold">$300M EBITDA by 12/31/28 · FY27 budget $180M, BHAG $200M</p>
        </div>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-5">
          {pillars.map((pillar) => (
            <a key={pillar.id} href={`#${pillar.id}`} className={`grid gap-1 border-t-4 bg-surface p-3 transition hover:bg-surface-2 ${toneBorder(pillar.status)}`}>
              <span className="text-sm font-semibold text-ink">{pillar.number} · {pillar.name}</span>
              <span className="text-[11px] text-ink-muted">{pillar.owner}</span>
              <span className="mt-1 text-[11px] text-ink-muted">{pillar.measure}</span>
              <span className="tabular text-lg font-semibold text-ink">{pillar.actual}</span>
              <span className="text-[10px] text-ink-faint">{pillar.target}</span>
              <StatusBadge tone={pillar.status}>{houseLabel(pillar.status)}</StatusBadge>
            </a>
          ))}
        </div>
        <div className="bg-navy px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-white">Servant Leadership · Ownership Mentality · Local · Excellence</div>
      </section>

      <section id="summary" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="summary-heading" title={SUMMARY.title} owner={SUMMARY.note} icon={SUMMARY.icon} />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryTiles.map(([label, value, delta, tone]) => <Card key={label} className="gap-0 rounded-md py-3"><CardContent className="px-3"><p className="text-xs text-ink-muted">{label}</p><p className="tabular mt-1 text-2xl font-semibold text-ink">{value}</p><p className={`mt-1 text-[11px] ${tone === "risk" ? "text-risk" : "text-ok"}`}>{delta}</p></CardContent></Card>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>So what</CardTitle></CardHeader><CardContent className={PAD}><ul className="grid gap-3 text-xs leading-5 text-ink-muted"><li><b className="text-ink">Shops beat, centre spent it.</b> Shop NOI was $1.0M over budget; Support and BD took it all, so Adj. EBITDA missed by $30K.</li><li><b className="text-ink">M&A is the year&apos;s engine.</b> 20 deals and $34.5M closed, 50% over the goal.</li><li><b className="text-ink">Retention had its best month, still behind on the year.</b> September was 10.4% annualized versus 12.4% YTD.</li><li><b className="text-ink">CAC is the number nobody has explained.</b> September was $7,639, 55% over budget.</li></ul></CardContent></Card>
          <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>Where the pillars stand</CardTitle></CardHeader><CardContent className={PAD}><div className="grid gap-2">{pillars.map((pillar) => <a key={pillar.id} href={`#${pillar.id}`} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0"><span className="font-medium text-ink">{pillar.name}</span><span className="tabular text-ink-muted">{pillar.actual}</span><StatusBadge tone={pillar.status} /></a>)}</div></CardContent></Card>
        </div>
      </section>

      <section id="financials" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="financials-heading" title={FINANCIALS.title} owner={FINANCIALS.note} icon={FINANCIALS.icon} />
        <div className="grid gap-4 xl:grid-cols-2">
          <div><h3 className="mb-2 text-sm font-semibold text-ink">P&L · September MTD and YTD ($M)</h3><ReviewTable caption="P&L, September MTD and YTD" headers={["Line", "Sept", "vs Bud", "vs PY", "YTD", "vs Bud", "vs PY"]} rows={financeRows} /></div>
          <div><h3 className="mb-2 text-sm font-semibold text-ink">KPIs · September MTD and YTD</h3><ReviewTable caption="KPIs, September MTD and YTD" headers={["KPI", "Sept", "Budget", "PY", "YTD", "Budget", "PY"]} rows={kpiRows} /></div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>LTM pro forma lender EBITDA</CardTitle></CardHeader><CardContent className={PAD}><div className="flex h-32 items-end gap-2 border-b border-l border-border px-3 pb-0">{ebitdaTrend.map((point) => <div key={point.m} className="flex-1 rounded-t-sm bg-navy/80" style={{ height: `${Math.max(8, Math.min(100, (point.v / Math.max(...ebitdaTrend.map((item) => item.v))) * 100))}%` }} title={`${point.m}: $${point.v.toFixed(1)}M`} />)}</div><p className="mt-3 text-xs text-ink-muted">Live from the editable EBITDA build. Each bar is a reporting-period observation.</p></CardContent></Card>
          <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>So what in the bridge</CardTitle></CardHeader><CardContent className={PAD}><ul className="grid gap-3 text-xs leading-5 text-ink-muted"><li><b className="text-ink">Rent drove the beat.</b> Commission revenue was $1.3M over budget.</li><li><b className="text-ink">Maintenance is losing money faster than planned.</b> Margin was −33% versus −12% budget.</li><li><b className="text-ink">Support ate the beat.</b> Support labor and other costs were −$0.9M.</li></ul></CardContent></Card>
        </div>
      </section>

      {pillars.map((pillar) => (
        <section key={pillar.id} id={pillar.id} className="scroll-mt-28 border-t border-border py-7">
          <SectionHeader id={`${pillar.id}-heading`} title={`Pillar ${pillar.number} · ${pillar.name}`} owner={pillar.owner} tone={pillar.status} icon={PILLAR_ICON[pillar.id] ?? Target} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className={CARD}>
              <CardHeader className={PAD}><CardTitle role="heading" aria-level={3} className="text-xs uppercase tracking-[0.08em] text-ink-faint">Measure · {pillar.measure}</CardTitle></CardHeader>
              <CardContent className={PAD}>
              <div className="flex flex-wrap items-baseline gap-3"><span className="tabular text-3xl font-semibold text-ink">{pillar.actual}</span><span className="text-xs text-ink-muted">{pillar.headline}</span></div>
              <Gauge tone={pillar.status} value={pillar.number === 3 ? 12.4 : pillar.number === 4 ? 4.4 : pillar.number === 5 ? 28 : pillar.number === 2 ? 46 : 34.5} target={pillar.number === 3 ? 12 : pillar.number === 4 ? 3.3 : pillar.number === 5 ? 25 : pillar.number === 2 ? 30 : 23} />
              <p className="text-xs text-ink-muted"><b className="text-ink">Target:</b> {pillar.target}</p>
              </CardContent>
            </Card>
            <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>So what</CardTitle></CardHeader><CardContent className={PAD}><ul className="grid gap-3 text-xs leading-5 text-ink-muted">{pillar.soWhat.map((item) => <li key={item} className="relative pl-4 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-ink-faint">{item}</li>)}</ul></CardContent></Card>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-ink">Strategic initiatives <span className="font-normal text-ink-muted">· select a card to open its charter</span></h3>
          <div className="grid gap-3 md:grid-cols-2">{pillar.initiatives.map((initiative) => <InitiativeCard key={initiative.code} initiative={initiative} onOpen={openCharter} />)}</div>
        </section>
      ))}

      <section id="milestones" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="milestones-heading" title={MILESTONES.title} owner={MILESTONES.note} icon={MILESTONES.icon} />
        <Card className="gap-0 rounded-md py-0">{pillars.flatMap((pillar) => pillar.initiatives.flatMap((initiative) => initiative.milestones.slice(0, 2).map((milestone) => ({ pillar, initiative, milestone })))).slice(0, 12).map(({ pillar, initiative, milestone }) => { const [title, date] = milestone.split(" · "); return <div key={`${initiative.code}-${milestone}`} className="grid gap-2 border-b border-border/60 px-4 py-3 last:border-0 sm:grid-cols-[110px_1fr_auto] sm:items-baseline"><span className="tabular text-xs text-ink-muted">{date ?? "TBD"}</span><span className="text-xs text-ink"><b className="font-semibold">{title}</b><span className="ml-2 text-ink-muted">{initiative.name}</span></span><span className="text-[10px] uppercase tracking-[0.08em] text-ink-faint">{pillar.name}</span></div>; })}</Card>
      </section>

      <section id="asks" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="asks-heading" title={ASKS.title} owner={ASKS.note} icon={ASKS.icon} />
        <div className="grid gap-3 md:grid-cols-2">{pillars.flatMap((pillar) => pillar.initiatives.filter((initiative) => initiative.ask).map((initiative) => <Card key={initiative.code} className={`${CARD} gap-0 border-navy/20 bg-navy/5`}><CardContent className={PAD}><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-navy-deep">{initiative.sponsor}</p><h3 className="mt-1 font-semibold text-ink">{initiative.name}</h3><p className="mt-2 text-xs leading-5 text-ink-muted">{initiative.ask}</p></CardContent></Card>))}</div>
      </section>

      <footer className="border-t border-border py-7 text-xs text-ink-faint"><p>Sources: September Flash Results, AwayDNA operating pack, FY27 strategic initiative charters and the 13 Oct 2026 ELT working session.</p><p className="mt-1">Confidential · for Awayday leadership</p></footer>

      <Dialog open={charterOpen} onOpenChange={(open) => { if (!open) closeCharter(); }}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          {selected && (
            <CharterBody
              initiative={selected}
              siblings={pillars.find((pillar) => pillar.initiatives.some((item) => item.code === selected.code))?.initiatives ?? [selected]}
              recordId={linkMap.get(selected.code)}
              onNavigate={openCharter}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
