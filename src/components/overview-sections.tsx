import { Fragment } from "react";
import Link from "next/link";
import type { Goal, Pillar, BoardItem, GoalColor } from "@/lib/sources";
import { STATUS_META } from "@/lib/initiatives";
import type { InitiativeStatus } from "@/generated/prisma/client";

// code -> initiative lookup (for SI progress + deep links).
export type SiInfo = { id: string; pct: number; status: InitiativeStatus };
export type SiMap = Record<string, SiInfo>;

// Status → pill tint, so Overview SI pills read at a glance (color + glyph).
const STATUS_PILL: Record<InitiativeStatus, string> = {
  NOT_STARTED: "bg-surface-2 text-ink-faint",
  PLANNING: "bg-navy/10 text-navy-deep",
  IN_PROGRESS: "bg-ok-soft text-ok",
  AT_RISK: "bg-risk-soft text-risk",
  DONE: "bg-done/15 text-done",
};

const COLOR: Record<GoalColor, string> = {
  green: "bg-ok-soft text-ok",
  amber: "bg-warn-soft text-warn",
  red: "bg-risk-soft text-risk",
  grey: "bg-surface-2 text-ink-faint",
};

export function siProgress(sis: string[], siMap: SiMap): number | null {
  const known = sis.map((c) => siMap[c]).filter(Boolean) as SiInfo[];
  if (known.length === 0) return null;
  return known.reduce((a, s) => a + (s.status === "DONE" ? 1 : s.pct), 0) / known.length;
}

export function ProgressMini({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] text-ink-faint">no SIs</span>;
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-navy" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular text-[11px] text-ink-muted">{pct}%</span>
    </div>
  );
}

function SiPill({ code, siMap }: { code: string; siMap: SiMap }) {
  const info = siMap[code];
  if (!info) return <span className="tabular rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-faint">{code}</span>;
  const m = STATUS_META[info.status];
  return (
    <Link
      href={`/initiatives/${info.id}`}
      title={`${m.label} · ${Math.round(info.pct * 100)}%`}
      className={`tabular inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 ${STATUS_PILL[info.status]}`}
    >
      <span className="text-[8px] leading-none" aria-hidden>{m.glyph}</span>
      {code}
    </Link>
  );
}

function CimPill({ code }: { code: string }) {
  return (
    <Link
      href={`/risks#${code}`}
      className="tabular rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted transition-colors hover:bg-border"
    >
      {code}
    </Link>
  );
}

function Pills({ codes, kind, siMap }: { codes: string[]; kind: "si" | "cim"; siMap?: SiMap }) {
  if (codes.length === 0) return <span className="text-[11px] text-ink-faint">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {codes.map((c) => (kind === "si" ? <SiPill key={c} code={c} siMap={siMap!} /> : <CimPill key={c} code={c} />))}
    </span>
  );
}

/* ---------- Financial & Operating Scorecard ---------- */

export function ScorecardTable({ goals, siMap }: { goals: Goal[]; siMap: SiMap }) {
  const groups: { category: string; rows: Goal[] }[] = [];
  for (const g of goals) {
    let grp = groups.find((x) => x.category === g.category);
    if (!grp) { grp = { category: g.category, rows: [] }; groups.push(grp); }
    grp.rows.push(g);
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-medium text-ink-faint">
            <th className="px-4 py-2.5 font-medium">Goal</th>
            <th className="px-3 py-2.5 font-medium">Target</th>
            <th className="px-3 py-2.5 font-medium">LTM</th>
            <th className="px-3 py-2.5 font-medium">YTD Bud</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">SI progress</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">CIM</th>
            <th className="px-3 py-2.5 font-medium">SIs driving</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((grp) => (
            <Fragment key={grp.category}>
              <tr className="bg-surface-2/40">
                <td colSpan={9} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  {grp.category}
                </td>
              </tr>
              {grp.rows.map((g) => (
                <tr key={g.id} className="border-b border-border/50 last:border-0 align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{g.name}</p>
                    <p className="mt-0.5 max-w-xs text-[11px] text-ink-faint">{g.notes}</p>
                  </td>
                  <td className="tabular px-3 py-2.5 whitespace-nowrap text-ink">{g.goal}</td>
                  <td className="tabular px-3 py-2.5 whitespace-nowrap text-ink-muted">{g.ltm}</td>
                  <td className="tabular px-3 py-2.5 whitespace-nowrap text-ink-muted">{g.ytdBud}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${COLOR[g.color]}`}>{g.status}</span>
                  </td>
                  <td className="px-3 py-2.5"><ProgressMini value={siProgress(g.sis, siMap)} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-ink-muted">{g.owner}</td>
                  <td className="px-3 py-2.5"><Pills codes={g.cim} kind="cim" /></td>
                  <td className="px-3 py-2.5"><Pills codes={g.sis} kind="si" siMap={siMap} /></td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- 2026 Goals pillar cards ---------- */

export function PillarCards({ pillars, siMap }: { pillars: Pillar[]; siMap: SiMap }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {pillars.map((p) => {
        const itemProgs = p.items.map((it) => siProgress(it.sis, siMap)).filter((v): v is number => v !== null);
        const overall = itemProgs.length ? itemProgs.reduce((a, b) => a + b, 0) / itemProgs.length : null;
        return (
          <div key={p.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start gap-2.5">
              <span className="text-lg" aria-hidden>{p.icon}</span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                <p className="text-xs italic text-navy-deep">{p.headline}</p>
              </div>
            </div>
            <div className="mt-3"><ProgressMini value={overall} /></div>
            <ul className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pt-3">
              {p.items.map((it) => (
                <li key={it.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink">{it.name}</span>
                    <ProgressMini value={siProgress(it.sis, siMap)} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{it.desc}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Pills codes={it.sis} kind="si" siMap={siMap} />
                    {it.cim.length > 0 && <Pills codes={it.cim} kind="cim" />}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Q2 board scorecard ---------- */

export function Q2Scorecard({ items, siMap }: { items: BoardItem[]; siMap: SiMap }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-medium text-ink-faint">
            <th className="px-4 py-2.5 font-medium">Theme</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">SI progress</th>
            <th className="px-3 py-2.5 font-medium">CIM</th>
            <th className="px-3 py-2.5 font-medium">SIs driving</th>
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} className="border-b border-border/50 last:border-0 align-top">
              <td className="px-4 py-2.5">
                <p className="font-medium text-ink">{b.name}</p>
                <p className="mt-0.5 max-w-md text-[11px] text-ink-faint">{b.desc}</p>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-xs text-ink-muted">{b.owner}</td>
              <td className="px-3 py-2.5"><ProgressMini value={siProgress(b.sis, siMap)} /></td>
              <td className="px-3 py-2.5"><Pills codes={b.cim} kind="cim" /></td>
              <td className="px-3 py-2.5"><Pills codes={b.sis} kind="si" siMap={siMap} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
