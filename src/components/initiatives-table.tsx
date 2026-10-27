"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, QuadrantBadge, ProgressBar } from "@/components/badges";
import { STATUS_META, QUADRANT_META, formatMoney, formatTeam } from "@/lib/initiatives";
import type { InitiativeStatus, Quadrant } from "@/generated/prisma/client";
import { TriangleAlert, ChevronRight, Plus, ChevronUp, ChevronDown, ChevronsUpDown } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FilterSelect } from "@/components/filter-select";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

/** The list pages' primary action, rendered in their PageHeader. */
export function NewInitiativeButton() {
  return (
    <Button asChild size="sm">
      <Link href="/admin/initiatives/new"><Plus size={14} aria-hidden /> New initiative</Link>
    </Button>
  );
}

export function InitiativesTable({
  rows,
  owners,
  cims,
  groups = [],
  initialGroup = "",
}: {
  rows: InitiativeRow[];
  owners: string[];
  cims: string[];
  groups?: { id: string; name: string }[];
  initialGroup?: string;
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
  const reset = () => { setQ(""); setOwner(""); setStatus(""); setQuadrant(""); setCim(""); setGroup(""); };
  const groupName = groups.find((g) => g.id === group)?.name;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, lead, driver…" className="w-56" />
        {groups.length > 0 && (
          <NativeSelect size="sm" value={group} onChange={(e) => setGroup(e.target.value)} className="px-2.5">
            <option value="">Group: all</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </NativeSelect>
        )}
        <FilterSelect value={cim} onChange={setCim} label="Pillar / enabler" options={cims} />
        <FilterSelect value={status} onChange={setStatus} label="Status" options={STATUSES} render={(s) => STATUS_META[s as InitiativeStatus].label} />
        <FilterSelect value={quadrant} onChange={setQuadrant} label="Priority" options={QUADRANTS} render={(qd) => QUADRANT_META[qd as Quadrant].label} />
        <FilterSelect value={owner} onChange={setOwner} label="Owner" options={owners} />
        {active && <Button variant="outline" size="sm" onClick={reset} className="px-2.5">Reset</Button>}
        <span className="text-xs text-ink-faint">{groupName ? `${groupName}: ` : ""}{filtered.length} of {rows.length}</span>
      </div>

      <Table stickyHeader containerClassName="rounded-lg border border-border bg-surface" className="text-sm">
        <TableHeader>
          <TableRow>
            <Th label="Initiative" k="name" sortKey={sortKey} dir={dir} onSort={sortBy} className="pl-4" />
            <Th label="Owner" k="teamLead" sortKey={sortKey} dir={dir} onSort={sortBy} />
            <Th label="Priority" k="quadrant" sortKey={sortKey} dir={dir} onSort={sortBy} />
            <Th label="Targeted value" k="valueTargeted" sortKey={sortKey} dir={dir} onSort={sortBy} align="right" />
            <Th label="Status" k="status" sortKey={sortKey} dir={dir} onSort={sortBy} />
            <Th label="Progress" k="pct" sortKey={sortKey} dir={dir} onSort={sortBy} className="w-40" />
            <Th label="Target" k="endTime" sortKey={sortKey} dir={dir} onSort={sortBy} className="pr-4" />
            <TableHead className="w-8" aria-hidden />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableEmpty colSpan={8}>
              No initiatives match these filters.{" "}
              {active && <Button type="button" variant="link" size="sm" onClick={reset}>Reset filters</Button>}
            </TableEmpty>
          )}
          {filtered.map((i) => (
            <TableRow
              key={i.id}
              data-interactive
              tabIndex={0}
              // The name is a real link (cmd/middle-click opens a tab); the rest of the row navigates too.
              onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) router.push(`/initiatives/${i.id}`); }}
              onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && router.push(`/initiatives/${i.id}`)}
              className="group focus-visible:bg-surface-2/60 focus-visible:shadow-[inset_3px_0_0_var(--color-navy)] focus-visible:outline-none"
            >
              <TableCell className="py-3 pl-4">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="tabular shrink-0 text-note text-ink-faint">{i.code}</span>
                  <Link href={`/initiatives/${i.id}`} tabIndex={-1} className="font-medium text-ink group-hover:text-navy-deep">{i.name}</Link>
                </div>
                {i.cimDriver && <span className="mt-0.5 block text-xs text-ink-muted">{i.cimDriver}</span>}
              </TableCell>
              <TableCell className="py-3 whitespace-nowrap text-ink-muted">{i.teamLead ?? "—"}</TableCell>
              <TableCell className="py-3">
                {i.valueType === "VALUE"
                  ? <QuadrantBadge quadrant={i.quadrant} />
                  : <Badge variant="secondary" className="rounded px-1.5 text-note">Non-value</Badge>}
              </TableCell>
              <TableCell className="tabular py-3 text-right whitespace-nowrap text-ink-muted">{i.valueType === "VALUE" && i.valueTargeted != null ? formatMoney(i.valueTargeted) : "—"}</TableCell>
              <TableCell className="py-3"><StatusBadge status={i.status} /></TableCell>
              <TableCell className="py-3"><ProgressBar value={i.pct} /></TableCell>
              <TableCell className="py-3 pr-4 whitespace-nowrap text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  {i.isBehind && <TriangleAlert size={13} className="text-warn" aria-label="Behind schedule" />}
                  {i.endLabel}
                </span>
              </TableCell>
              <TableCell className="py-3 pl-0 pr-3 text-ink-faint">
                <ChevronRight size={15} className="opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function Th({ label, k, sortKey, dir, onSort, className, align = "left" }: { label: string; k: SortKey; sortKey: SortKey; dir: 1 | -1; onSort: (k: SortKey) => void; className?: string; align?: "left" | "right" }) {
  const active = sortKey === k;
  const Icon = !active ? ChevronsUpDown : dir === 1 ? ChevronUp : ChevronDown;
  return (
    <TableHead aria-sort={active ? (dir === 1 ? "ascending" : "descending") : "none"} className={cn(align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-surface hover:text-ink", active && "text-ink")}
      >
        {label}
        <Icon size={12} className={cn("transition-opacity", !active && "opacity-0 group-hover/sort:opacity-60")} aria-hidden />
      </button>
    </TableHead>
  );
}
