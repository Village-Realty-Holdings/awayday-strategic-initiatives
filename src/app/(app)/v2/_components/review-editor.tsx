"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PeriodStatus, PillarTone, UpdateState } from "../_mock/types";
import { MockNote } from "./preview";
import { PeriodStatusBadge, PillarLabelBadge, TONE_OPTIONS, UpdateStateBadge } from "./status";

export type EditorSoWhat = { id: string; headline: string; body: string };
export type EditorPillar = { areaCode: string; name: string; label: string; tone: PillarTone; commentary: string };
export type EditorSiRow = { code: string; shortCode: string; name: string; area: string; owner: string; state: UpdateState };

export function ReviewEditor({
  periodId,
  periodLabel,
  initialStatus,
  soWhats: initialSoWhats,
  pillars: initialPillars,
  sis,
}: {
  periodId: string;
  periodLabel: string;
  initialStatus: PeriodStatus;
  soWhats: EditorSoWhat[];
  pillars: EditorPillar[];
  sis: EditorSiRow[];
}) {
  const [status, setStatus] = useState<PeriodStatus>(initialStatus);
  const [soWhats, setSoWhats] = useState(initialSoWhats);
  const [pillars, setPillars] = useState(initialPillars);
  const [stateFilter, setStateFilter] = useState<UpdateState | "ALL">("ALL");
  const locked = status === "PUBLISHED";

  const counts = { SUBMITTED: 0, DRAFT: 0, NOT_SUBMITTED: 0 } as Record<UpdateState, number>;
  for (const s of sis) counts[s.state] += 1;
  const rows = sis.filter((s) => stateFilter === "ALL" || s.state === stateFilter);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodStatusBadge status={status} />
          <MockNote />
          {locked && <span className="text-xs text-ink-muted">Published: editing is locked. Unpublish to make changes.</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/v2/review/${periodId}`}>Preview review</Link>
          </Button>
          <Button size="sm" variant={locked ? "outline" : "default"} onClick={() => setStatus(locked ? "DRAFT" : "PUBLISHED")}>
            <Send size={12} aria-hidden /> {locked ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Summary so-whats · {periodLabel}</h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={locked}
            onClick={() => setSoWhats((l) => [...l, { id: `new-${l.length + 1}-${Date.now()}`, headline: "", body: "" }])}
          >
            <Plus size={12} aria-hidden /> Add so-what
          </Button>
        </div>
        <ul className="flex flex-col gap-3">
          {soWhats.map((s, i) => (
            <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="tabular mt-2 w-5 shrink-0 text-xs text-ink-faint">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <Label className="flex flex-col gap-1.5">
                    Headline
                    <Input
                      value={s.headline}
                      disabled={locked}
                      onChange={(e) => setSoWhats((l) => l.map((x) => (x.id === s.id ? { ...x, headline: e.target.value } : x)))}
                    />
                  </Label>
                  <Label className="flex flex-col gap-1.5">
                    Detail
                    <Textarea
                      rows={3}
                      value={s.body}
                      disabled={locked}
                      onChange={(e) => setSoWhats((l) => l.map((x) => (x.id === s.id ? { ...x, body: e.target.value } : x)))}
                    />
                  </Label>
                </div>
                <Button
                  variant="faint"
                  size="icon"
                  aria-label={`Remove so-what ${i + 1}`}
                  disabled={locked}
                  onClick={() => setSoWhats((l) => l.filter((x) => x.id !== s.id))}
                >
                  <Trash2 size={14} aria-hidden />
                </Button>
              </div>
            </li>
          ))}
          {soWhats.length === 0 && <li className="text-xs text-ink-faint">No so-whats yet.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Pillar status and commentary</h2>
        <ul className="flex flex-col gap-3">
          {pillars.map((p) => (
            <li key={p.areaCode} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                <PillarLabelBadge label={p.label || "Untitled"} tone={p.tone} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem]">
                <Label className="flex flex-col gap-1.5">
                  Status label
                  <Input
                    value={p.label}
                    disabled={locked}
                    onChange={(e) => setPillars((l) => l.map((x) => (x.areaCode === p.areaCode ? { ...x, label: e.target.value } : x)))}
                  />
                </Label>
                <Label className="flex flex-col gap-1.5">
                  Colour
                  <NativeSelect
                    value={p.tone}
                    disabled={locked}
                    onChange={(e) => setPillars((l) => l.map((x) => (x.areaCode === p.areaCode ? { ...x, tone: e.target.value as PillarTone } : x)))}
                  >
                    {TONE_OPTIONS.map((o) => (
                      <option key={o.tone} value={o.tone}>{o.label}</option>
                    ))}
                  </NativeSelect>
                </Label>
              </div>
              <Label className="mt-3 flex flex-col gap-1.5">
                Commentary
                <Textarea
                  rows={2}
                  value={p.commentary}
                  disabled={locked}
                  onChange={(e) => setPillars((l) => l.map((x) => (x.areaCode === p.areaCode ? { ...x, commentary: e.target.value } : x)))}
                />
              </Label>
            </li>
          ))}
        </ul>
      </section>

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
    </div>
  );
}
