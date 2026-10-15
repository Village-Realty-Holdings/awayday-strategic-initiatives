"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

export type EditorSoWhat = { id: string; headline: string; body: string };

/**
 * Add / edit / remove list of so-whats for one scope (the summary, or one
 * pillar). State lives in the parent so the editor can lock everything at once.
 */
export function SoWhatEditor({
  scopeLabel,
  items,
  onChange,
  locked,
  compact = false,
}: {
  scopeLabel: string;
  items: EditorSoWhat[];
  onChange: (next: EditorSoWhat[]) => void;
  locked: boolean;
  /** Tighter rows for the per-pillar lists. */
  compact?: boolean;
}) {
  const update = (id: string, patch: Partial<EditorSoWhat>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {items.map((s, i) => (
          <li key={s.id}>
            <Card className="gap-0 p-4">
              <div className="flex items-start gap-3">
                <span className="tabular mt-2 w-5 shrink-0 text-xs text-ink-faint">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <Label className="flex flex-col gap-1.5">
                    Headline
                    <Input value={s.headline} disabled={locked} onChange={(e) => update(s.id, { headline: e.target.value })} />
                  </Label>
                  <Label className="flex flex-col gap-1.5">
                    Detail
                    <Textarea rows={compact ? 2 : 3} value={s.body} disabled={locked} onChange={(e) => update(s.id, { body: e.target.value })} />
                  </Label>
                </div>
                <Button
                  variant="faint"
                  size="icon"
                  aria-label={`Remove ${scopeLabel} so-what ${i + 1}`}
                  disabled={locked}
                  onClick={() => onChange(items.filter((x) => x.id !== s.id))}
                >
                  <Trash2 size={14} aria-hidden />
                </Button>
              </div>
            </Card>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-ink-faint">No so-whats yet.</li>}
      </ul>
      <div>
        <Button
          size="sm"
          variant="secondary"
          disabled={locked}
          onClick={() => onChange([...items, { id: `new-${scopeLabel}-${items.length + 1}-${Date.now()}`, headline: "", body: "" }])}
        >
          <Plus size={12} aria-hidden /> Add so-what
        </Button>
      </div>
    </div>
  );
}
