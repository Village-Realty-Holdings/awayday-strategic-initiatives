"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, QuadrantBadge, ProgressBar } from "@/components/badges";
import { STATUS_META, QUADRANT_META, formatMoney, formatTeam } from "@/lib/initiatives";
import type { InitiativeStatus, Quadrant } from "@/generated/prisma/client";
import { TriangleAlert, ChevronRight, Plus, ChevronUp, ChevronDown } from "lucide-react";

export type InitiativeRow = {
  id: string;
  code: string;
  name: string;
  cimDriver: string | null;
  teamLead: string | null;
  supports: string | null;
  quadrant: Quadrant;
  value: number;
  lift: number;
  valueTargeted: number | null;
  valueType: string;
  status: InitiativeStatus;
  pct: number;
  endLabel: string;
  endTime: number | null;
  groupIds: string[];
  isBehind: boolean;
};

const STATUSES = Object.keys(STATUS_META) as InitiativeStatus[];
const QUADRANTS = Object.keys(QUADRANT_META) as Quadrant[];
type SortKey = "code" | "name" | "cimDriver" | "teamLead" | "valueTargeted" | "quadrant" | "status" | "pct" | "endTime";

export function InitiativesTable({
  rows,
  owners,
  cims,
  groups = [],
  initialGroup = "",
  editable,
}: {
  rows: InitiativeRow[];
  owners: string[];
  cims: string[];
  groups?: { id: string; name: string }[];
  initialGroup?: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("");
  const [quadrant, setQuadrant] = useState("");
  const [cim, setCim] = useState("");
  const [group, setGroup] = useState(initialGroup);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [dir, setDir] = useState<1 | -1>(1);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setDir(1); }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (needle && !`${r.code} ${r.name} ${r.teamLead ?? ""} ${r.cimDriver ?? ""} ${formatTeam(r.supports)}`.toLowerCase().includes(needle)) return false;
      if (owner && r.teamLead !== owner) return false;
      if (status && r.status !== status) return false;
      if (quadrant && r.quadrant !== quadrant) return false;
      if (cim && r.cimDriver !== cim) return false;
      if (group && !r.groupIds.includes(group)) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sortKey === "endTime") {
        const av = a.endTime, bv = b.endTime;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      }
      if (sortKey === "valueTargeted") {
        return ((a.valueTargeted ?? -1) - (b.valueTargeted ?? -1)) * dir;
      }
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
    return out;
  }, [rows, q, owner, status, quadrant, cim, group, sortKey, dir]);

  const active = q || owner || status || quadrant || cim || group;
  const groupName = groups.find((g) => g.id === group)?.name;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, lead, driver…" className="w-56 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
        {groups.length > 0 && (
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-navy">
            <option value="">Group: all</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <Sel value={cim} onChange={setCim} label="CIM driver" options={cims} />
        <Sel value={status} onChange={setStatus} label="Status" options={STATUSES} render={(s) => STATUS_META[s as InitiativeStatus].label} />
        <Sel value={quadrant} onChange={setQuadrant} label="Priority" options={QUADRANTS} render={(qd) => QUADRANT_META[qd as Quadrant].label} />
        <Sel value={owner} onChange={setOwner} label="Owner" options={owners} />
        {active && <button onClick={() => { setQ(""); setOwner(""); setStatus(""); setQuadrant(""); setCim(""); setGroup(""); }} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2">Reset</button>}
        <span className="text-xs text-ink-faint">{groupName ? `${groupName}: ` : ""}{filtered.length} of {rows.length}</span>
        {editable && <Link href="/initiatives/new" className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-deep"><Plus size={14} aria-hidden /> New initiative</Link>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-ink-faint">
              <Th label="Initiative" k="name" sortKey={sortKey} dir={dir} onSort={sortBy} className="px-4" />
              <Th label="Owner" k="teamLead" sortKey={sortKey} dir={dir} onSort={sortBy} />
              <Th label="Priority" k="quadrant" sortKey={sortKey} dir={dir} onSort={sortBy} />
              <Th label="Targeted value" k="valueTargeted" sortKey={sortKey} dir={dir} onSort={sortBy} />
              <Th label="Status" k="status" sortKey={sortKey} dir={dir} onSort={sortBy} />
              <Th label="Progress" k="pct" sortKey={sortKey} dir={dir} onSort={sortBy} className="w-40" />
              <Th label="Target" k="endTime" sortKey={sortKey} dir={dir} onSort={sortBy} className="px-4" />
              <th className="w-8" aria-hidden></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr
                key={i.id}
                tabIndex={0}
                onClick={() => router.push(`/initiatives/${i.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/initiatives/${i.id}`)}
                className="group cursor-pointer border-b border-border/60 last:border-0 transition-colors hover:bg-surface-2/60"
              >
                <td className="px-4 py-3">
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="tabular shrink-0 text-[11px] text-ink-faint">{i.code}</span>
                    <span className="font-medium text-ink group-hover:text-navy-deep">{i.name}</span>
                  </div>
                  {i.cimDriver && <span className="mt-0.5 block text-xs text-ink-muted">{i.cimDriver}</span>}
                </td>
                <td className="px-3 py-3 text-ink-muted">{i.teamLead ?? "—"}</td>
                <td className="px-3 py-3">
                  {i.valueType === "VALUE"
                    ? <QuadrantBadge quadrant={i.quadrant} />
                    : <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">Non-value</span>}
                </td>
                <td className="tabular px-3 py-3 text-ink-muted">{i.valueType === "VALUE" && i.valueTargeted != null ? formatMoney(i.valueTargeted) : "—"}</td>
                <td className="px-3 py-3"><StatusBadge status={i.status} /></td>
                <td className="px-3 py-3"><ProgressBar value={i.pct} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    {i.isBehind && <TriangleAlert size={13} className="text-warn" aria-label="Behind schedule" />}
                    {i.endLabel}
                  </span>
                </td>
                <td className="pr-3 text-ink-faint"><ChevronRight size={15} className="opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-muted">No initiatives match these filters.</p>}
      </div>
    </>
  );
}

function Th({ label, k, sortKey, dir, onSort, className = "", center }: { label: string; k: SortKey; sortKey: SortKey; dir: 1 | -1; onSort: (k: SortKey) => void; className?: string; center?: boolean }) {
  const active = sortKey === k;
  return (
    <th className={`py-2.5 font-medium ${className || "px-3"}`}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${center ? "justify-center" : ""} ${active ? "text-ink" : ""}`}>
        {label}
        {active && (dir === 1 ? <ChevronUp size={11} aria-hidden /> : <ChevronDown size={11} aria-hidden />)}
      </button>
    </th>
  );
}

function Sel({ value, onChange, label, options, render }: { value: string; onChange: (v: string) => void; label: string; options: string[]; render?: (v: string) => string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-navy">
      <option value="">{label}: all</option>
      {options.map((o) => <option key={o} value={o}>{render ? render(o) : o}</option>)}
    </select>
  );
}
