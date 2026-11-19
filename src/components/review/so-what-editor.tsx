"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { SO_WHAT_LIMITS, SO_WHAT_TONES, type SoWhatToneValue } from "@/lib/review-model";

/**
 * One so-what while it is being edited. `tone` is the stored value (or "" when
 * none is chosen); the editor never holds a CSS class name.
 */
export type EditorSoWhat = { key: string; headline: string; body: string; tone: SoWhatToneValue | "" };

let nextKey = 0;
export function newSoWhat(): EditorSoWhat {
  return { key: `new-${Date.now()}-${nextKey++}`, headline: "", body: "", tone: "" };
}

const TONE_LABEL: Record<SoWhatToneValue, string> = {
  POSITIVE: "Positive",
  WARNING: "Watch",
  NEGATIVE: "Negative",
  NEUTRAL: "Note",
};

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Add / edit / reorder / remove the so-whats for one scope (the summary, or one
 * pillar or enabler). State lives in the parent, which saves every scope at once.
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
  /** Tighter rows for the per-area lists. */
  compact?: boolean;
}) {
  const update = (key: string, patch: Partial<EditorSoWhat>) => onChange(items.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {items.map((s, i) => (
          <li key={s.key}>
            <Card className="gap-0 p-4">
              <div className="flex items-start gap-3">
                <span className="tabular mt-2 w-5 shrink-0 text-xs text-ink-faint">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <Label className="flex flex-col gap-1.5">
                    Headline
                    <Input
                      value={s.headline}
                      maxLength={SO_WHAT_LIMITS.headline}
                      placeholder="Shops beat, centre spent it."
                      onChange={(e) => update(s.key, { headline: e.target.value })}
                    />
                  </Label>
                  <Label className="flex flex-col gap-1.5">
                    Detail
                    <Textarea
                      rows={compact ? 2 : 3}
                      value={s.body}
                      maxLength={SO_WHAT_LIMITS.body}
                      placeholder="The numbers behind it, and what the ELT should take from it."
                      onChange={(e) => update(s.key, { body: e.target.value })}
                    />
                  </Label>
                  <Label className="flex flex-col gap-1.5">
                    Tone
                    <NativeSelect
                      name="soWhatTone"
                      aria-label={`Tone for ${scopeLabel} so-what ${i + 1}`}
                      value={s.tone}
                      disabled={locked}
                      onChange={(e) => update(s.key, { tone: e.target.value as SoWhatToneValue | "" })}
                    >
                      <option value="">Inherit the section</option>
                      {SO_WHAT_TONES.map((tone) => (
                        <option key={tone} value={tone}>
                          {TONE_LABEL[tone]}
                        </option>
                      ))}
                    </NativeSelect>
                  </Label>
                </div>
                {!locked && (
                  <div className="flex shrink-0 flex-col">
                    <Button type="button" variant="faint" size="icon" aria-label={`Move ${scopeLabel} so-what ${i + 1} up`} disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}>
                      <ChevronUp size={14} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="faint"
                      size="icon"
                      aria-label={`Move ${scopeLabel} so-what ${i + 1} down`}
                      disabled={i === items.length - 1}
                      onClick={() => onChange(move(items, i, i + 1))}
                    >
                      <ChevronDown size={14} aria-hidden />
                    </Button>
                    <Button type="button" variant="faint" size="icon" aria-label={`Remove ${scopeLabel} so-what ${i + 1}`} onClick={() => onChange(items.filter((x) => x.key !== s.key))}>
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-ink-faint">No so-whats yet.</li>}
      </ul>
      {!locked && items.length < SO_WHAT_LIMITS.perScope && (
        <div>
          <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...items, newSoWhat()])}>
            <Plus size={12} aria-hidden /> Add so-what
          </Button>
        </div>
      )}
    </div>
  );
}
