"use client";

import { useState } from "react";
import { Sparkles, Loader2, Send, RotateCcw } from "@/components/icons";
import { askBoard, type AiResult } from "@/app/(app)/ai-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const SUGGESTIONS = [
  "What should the board worry about most this quarter?",
  "Which initiatives are slipping and why does it matter?",
  "Summarize progress toward the 2026 EBITDA target.",
];

// `ask` is injectable so /dev/comparison can drive the panel with mock answers.
export function AskPanel({ ask: askFn = askBoard }: { ask?: (question: string) => Promise<AiResult> } = {}) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const r = await askFn(question);
      if (r.ok) setAnswer(r.text);
      else setError(r.error);
    } catch {
      // A thrown server action (network drop, redeploy) must not leave the panel stuck on "Thinking…".
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQ("");
    setAnswer(null);
    setError(null);
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="accent" size="sm" title="AI board narrative">
          <Sparkles size={13} strokeWidth={2} aria-hidden />
          Ask
        </Button>
      </SheetTrigger>

      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles size={15} className="text-gold-deep" aria-hidden />
            Ask the board narrative
          </SheetTitle>
          <SheetDescription>
            Claude answers using a live snapshot of the portfolio: EBITDA build, initiative health,
            and critical risks. Answers are generated, so sanity-check before quoting.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
          {!answer && !loading && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Try</p>
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setQ(s); ask(s); }}
                  className="justify-start whitespace-normal bg-surface-2/40 py-2 text-left font-normal hover:border-navy/40 hover:text-ink"
                >
                  {s}
                </Button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 size={15} className="animate-spin" aria-hidden /> Thinking…
            </div>
          )}
          {error && <p className="mt-4 rounded-md bg-risk-soft px-3 py-2 text-xs text-risk">{error}</p>}
          {answer && (
            <>
              <div className="rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-sm leading-relaxed text-ink">
                <p className="whitespace-pre-line">{answer}</p>
              </div>
              <Button type="button" variant="ghost" size="xs" onClick={reset} className="mt-2">
                <RotateCcw size={12} aria-hidden />
                New question
              </Button>
            </>
          )}
        </div>

        <SheetFooter>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex items-end gap-2">
            <Textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
              rows={2}
              placeholder="Ask about the portfolio…"
              aria-label="Question"
              className="min-w-0 flex-1 resize-none"
            />
            <Button type="submit" size="icon" disabled={loading || !q.trim()} aria-label="Send">
              {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
            </Button>
          </form>
          <p className="mt-1.5 text-[10px] text-ink-faint">Enter to send · Shift+Enter for a new line</p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
