"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { MockMilestone } from "../_mock/types";
import { TimelineGroups } from "./timeline-groups";

export type TimelineItem = MockMilestone & { within60: boolean; pastDue: boolean };

export function TimelineExplorer({
  items,
  pillars,
  owners,
}: {
  items: TimelineItem[];
  pillars: { value: string; label: string }[];
  owners: { id: string; name: string }[];
}) {
  const [pillar, setPillar] = useState("ALL");
  const [owner, setOwner] = useState("ALL");
  const [range, setRange] = useState<"60" | "ALL">("60");
  const [pastOnly, setPastOnly] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter((m) => {
        if (range === "60" && !m.within60) return false;
        if (pastOnly && !m.pastDue) return false;
        if (owner !== "ALL" && !m.ownerIds.includes(owner)) return false;
        if (pillar === "ALL") return true;
        if (pillar === "SI_PROCESS") return m.kind === "SI_PROCESS";
        if (pillar === "NON_SI") return m.kind !== "SI";
        return m.pillar === pillar;
      }),
    [items, pillar, owner, range, pastOnly],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Label className="flex flex-col gap-1.5">
          Pillar
          <NativeSelect value={pillar} onChange={(e) => setPillar(e.target.value)}>
            <option value="ALL">All items</option>
            <option value="SI_PROCESS">SI process</option>
            <option value="NON_SI">Non-SI items</option>
            {pillars.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5">
          Owner
          <NativeSelect value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="ALL">Everyone</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5">
          Window
          <NativeSelect value={range} onChange={(e) => setRange(e.target.value as "60" | "ALL")}>
            <option value="60">Next 60 days</option>
            <option value="ALL">Through 31 Dec</option>
          </NativeSelect>
        </Label>
        <label className="flex items-end gap-2 pb-2 text-xs text-ink-muted">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--color-navy)]" checked={pastOnly} onChange={(e) => setPastOnly(e.target.checked)} />
          Needs a status only
        </label>
      </div>
      <p className="text-xs text-ink-muted" aria-live="polite">
        {filtered.length} milestone{filtered.length === 1 ? "" : "s"} · amber dates have passed and need a status.
      </p>
      <TimelineGroups milestones={filtered} />
    </div>
  );
}
