"use client";

import { useState } from "react";
import { Sparkles, X, Loader2, Send } from "lucide-react";
import { askBoard } from "@/app/(app)/ai-actions";

const SUGGESTIONS = [
  "What should the board worry about most this quarter?",
  "Which initiatives are slipping and why does it matter?",
  "Summarize progress toward the 2026 EBITDA target.",
];

export function AskPanel() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    const r = await askBoard(question);
    setLoading(false);
    if (r.ok) setAnswer(r.text);
    else setError(r.error);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="AI board narrative"
        className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-medium text-navy-deep transition-colors hover:bg-gold/20"
      >
        <Sparkles size={13} strokeWidth={2} aria-hidden />
        Ask
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy-deep/30 backdrop-blur-[1px]"
          />
          <aside className="relative flex h-dvh w-full max-w-md flex-col border-l border-border bg-surface shadow-xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-gold-deep" aria-hidden />
                <h2 className="text-sm font-semibold text-ink">Ask the board narrative</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-faint transition-colors hover:text-ink">
                <X size={16} aria-hidden />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-xs text-ink-muted">
                Claude answers using a live snapshot of the portfolio: EBITDA build, initiative health,
                and critical risks. Answers are generated, so sanity-check before quoting.
              </p>

              {!answer && !loading && (
                <div className="mt-4 flex flex-col gap-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Try</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setQ(s); ask(s); }}
                      className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-left text-xs text-ink-muted transition-colors hover:border-navy/40 hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {loading && (
                <div className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
                  <Loader2 size={15} className="animate-spin" aria-hidden /> Thinking…
                </div>
              )}
              {error && <p className="mt-4 rounded-md bg-risk-soft px-3 py-2 text-xs text-risk">{error}</p>}
              {answer && (
                <div className="mt-4 rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-sm leading-relaxed text-ink">
                  <p className="whitespace-pre-line">{answer}</p>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); ask(q); }}
              className="border-t border-border px-5 py-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
                  rows={2}
                  placeholder="Ask about the portfolio…"
                  className="min-w-0 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
                <button
                  type="submit"
                  disabled={loading || !q.trim()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy text-white transition-colors hover:bg-navy-deep disabled:opacity-50"
                >
                  <Send size={15} aria-hidden />
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
