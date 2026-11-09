"use client";

import { useState } from "react";
import { Copy, Check } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** A read-only value (a URL or a command) with a Copy button. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context): the value stays selectable.
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code aria-label={label} className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-ink select-all">
        {value}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5 px-3">
        {copied ? <Check size={14} className="text-ok" aria-hidden /> : <Copy size={14} aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
