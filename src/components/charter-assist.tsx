"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assistCharter } from "@/app/(app)/ai-actions";

export function CharterAssistButton({
  initiativeId,
  kind,
  label,
}: {
  initiativeId: string;
  kind: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setCopied(false);
    const r = await assistCharter(initiativeId, kind);
    setLoading(false);
    if (r.ok) setResult(r.text);
    else setError(r.error);
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-2.5">
      <Button type="button" variant="accent" size="xs" onClick={run} disabled={loading} className="px-2.5">
        {loading ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Sparkles size={12} aria-hidden />}
        {label}
      </Button>
      {error && <p className="mt-1.5 text-[11px] text-risk">{error}</p>}
      {result && (
        <div className="mt-2 rounded-md border-l-2 border-gold bg-surface-2/50 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          <p className="whitespace-pre-line">{result}</p>
          <Button type="button" variant="faint" size="bare" onClick={copy} className="mt-1.5 gap-1 text-[10px] hover:text-navy">
            {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  );
}
