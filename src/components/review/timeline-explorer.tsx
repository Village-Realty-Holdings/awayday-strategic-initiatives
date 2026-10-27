"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { addDaysIso, type ReviewMilestone } from "@/lib/review-model";
import { TimelineGroups } from "./timeline-groups";

export function TimelineExplorer({
  milestones,
  areas,
  owners,
  today,
}: {
  milestones: ReviewMilestone[];
  areas: { value: string; label: string }[];
  owners: string[];
  today: string;
}) {
  const [area, setArea] = useState("ALL");
  const [owner, setOwner] = useState("ALL");
  const [range, setRange] = useState<"60" | "ALL">("60");
  const [pastOnly, setPastOnly] = useState(false);
  const end60 = addDaysIso(today, 60);
  const areaNames = useMemo(() => Object.fromEntries(areas.map((a) => [a.value, a.label])), [areas]);

  const filtered = useMemo(
    () =>
      milestones.filter((m) => {
        const past = Boolean(m.date && m.date < today && !m.done);
        if (pastOnly && !past) return false;
        if (range === "60" && !past && (!m.date || m.date > end60 || m.done)) return false;
        if (owner !== "ALL" && m.owner !== owner) return false;
        return area === "ALL" || m.areaCode === area;
      }),
    [milestones, area, owner, range, pastOnly, today, end60],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Label className="flex flex-col gap-1.5">
          Area
          <NativeSelect value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="ALL">All areas</option>
            {areas.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5">
          Owner
          <NativeSelect value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="ALL">Everyone</option>
            {owners.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5">
          Window
          <NativeSelect value={range} onChange={(e) => setRange(e.target.value as "60" | "ALL")}>
            <option value="60">Next 60 days (plus passed)</option>
            <option value="ALL">All milestones</option>
          </NativeSelect>
        </Label>
        <Label className="flex cursor-pointer items-center gap-2 self-end pb-2.5 font-normal">
          <Checkbox checked={pastOnly} onCheckedChange={(c) => setPastOnly(c === true)} />
          Needs a status only
        </Label>
      </div>
      <p className="text-xs text-ink-muted" aria-live="polite">
        {filtered.length} milestone{filtered.length === 1 ? "" : "s"} · amber dates have passed and need a status.
      </p>
      <TimelineGroups milestones={filtered} today={today} areaNames={areaNames} />
    </div>
  );
}
