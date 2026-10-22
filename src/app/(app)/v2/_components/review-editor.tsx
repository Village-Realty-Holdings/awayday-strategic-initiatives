"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PeriodStatus, PillarTone, UpdateState } from "../_mock/types";
import { MockNote } from "./preview";
import { type EditorSoWhat, SoWhatEditor } from "./so-what-editor";
import { PeriodStatusBadge, PillarLabelBadge, TONE_OPTIONS } from "./status";
import { SiSubmissionStatus } from "./si-submission-status";

export type { EditorSoWhat };
export type EditorPillar = { areaCode: string; name: string; label: string; tone: PillarTone; commentary: string };
export type EditorSiRow = { code: string; shortCode: string; name: string; area: string; owner: string; state: UpdateState };

export function ReviewEditor({
  periodId,
  periodLabel,
  initialStatus,
  summarySoWhats: initialSummary,
  pillarSoWhats: initialPillarSoWhats,
  pillars: initialPillars,
  sis,
}: {
  periodId: string;
  periodLabel: string;
  initialStatus: PeriodStatus;
  summarySoWhats: EditorSoWhat[];
  /** So-whats per pillar, keyed by area code. */
  pillarSoWhats: Record<string, EditorSoWhat[]>;
  pillars: EditorPillar[];
  sis: EditorSiRow[];
}) {
  const [status, setStatus] = useState<PeriodStatus>(initialStatus);
  const [summary, setSummary] = useState(initialSummary);
  const [pillarSoWhats, setPillarSoWhats] = useState(initialPillarSoWhats);
  const [pillars, setPillars] = useState(initialPillars);
  const locked = status === "PUBLISHED";


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
        <h2 className="mb-3 text-sm font-semibold text-ink">Summary so-whats · {periodLabel}</h2>
        <SoWhatEditor scopeLabel="summary" items={summary} onChange={setSummary} locked={locked} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Pillar status, commentary and so-whats</h2>
        <ul className="flex flex-col gap-3">
          {pillars.map((p) => (
            <li key={p.areaCode}>
            <Card className="gap-0 p-4">
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
              <div className="mt-5 border-t border-border/70 pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-ink">So what · {p.name}</h4>
                  <span className="text-[11px] text-ink-faint">{(pillarSoWhats[p.areaCode] ?? []).length} shown on the pillar</span>
                </div>
                <SoWhatEditor
                  compact
                  scopeLabel={p.name}
                  items={pillarSoWhats[p.areaCode] ?? []}
                  onChange={(next) => setPillarSoWhats((m) => ({ ...m, [p.areaCode]: next }))}
                  locked={locked}
                />
              </div>
            </Card>
            </li>
          ))}
        </ul>
      </section>

      <SiSubmissionStatus sis={sis} />
    </div>
  );
}
