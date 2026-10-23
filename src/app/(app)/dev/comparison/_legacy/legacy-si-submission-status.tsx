"use client";

// SNAPSHOT of the "SI submission status" section of
// src/app/(app)/v2/_components/review-editor.tsx before the shadcn
// ToggleGroup + Table migration, kept only for /dev/comparison.
import { useState } from "react";
import Link from "next/link";
import type { UpdateState } from "@/app/(app)/v2/_mock/types";
import type { EditorSiRow } from "@/app/(app)/v2/_components/review-editor";
import { UpdateStateBadge } from "@/app/(app)/v2/_components/status";

export function LegacySiSubmissionStatus({ sis }: { sis: EditorSiRow[] }) {
  const [stateFilter, setStateFilter] = useState<UpdateState | "ALL">("ALL");
  const counts = { SUBMITTED: 0, DRAFT: 0, NOT_SUBMITTED: 0 } as Record<UpdateState, number>;
  for (const s of sis) counts[s.state] += 1;
  const rows = sis.filter((s) => stateFilter === "ALL" || s.state === stateFilter);
  return (
  <section>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-ink">SI submission status</h2>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {([["ALL", `All ${sis.length}`], ["SUBMITTED", `Submitted ${counts.SUBMITTED}`], ["DRAFT", `Draft ${counts.DRAFT}`], ["NOT_SUBMITTED", `Not submitted ${counts.NOT_SUBMITTED}`]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setStateFilter(k)}
            aria-pressed={stateFilter === k}
            className={`rounded-md border px-2.5 py-1 transition-colors ${
              stateFilter === k ? "border-navy bg-navy/10 font-medium text-navy-deep" : "border-border text-ink-muted hover:bg-surface-2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[40rem] text-xs">
        <thead className="bg-surface-2 text-left text-ink-muted">
          <tr>
            <th className="px-3 py-2 font-medium">SI</th>
            <th className="px-3 py-2 font-medium">Area</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">This month</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((s) => (
            <tr key={s.code}>
              <td className="px-3 py-2">
                <Link href={`/v2/si/${s.code}`} className="font-medium text-ink hover:text-navy-deep">
                  <span className="tabular mr-2 text-[10px] text-ink-faint">{s.shortCode}</span>
                  {s.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-ink-muted">{s.area}</td>
              <td className="px-3 py-2 text-ink-muted">{s.owner}</td>
              <td className="px-3 py-2"><UpdateStateBadge state={s.state} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="mt-2 text-[11px] text-ink-faint">Nothing on this page is saved. Owners submit from My SIs.</p>
  </section>
  );
}
