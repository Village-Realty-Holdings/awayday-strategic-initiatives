"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, Loader2, Copy, Check, TriangleAlert, FileDown, Pencil, Eye } from "lucide-react";
import { generateBoardNarrative } from "@/app/(app)/ai-actions";

// --- tiny markdown renderer for the constrained output the prompt produces
// (## / ### headings, - or * bullets, 1. numbered, **bold**, paragraphs). ---
function inline(s: string, kp: string) {
  return s.split(/\*\*/).map((part, i) =>
    i % 2 === 1 ? <strong key={kp + i}>{part}</strong> : <span key={kp + i}>{part}</span>,
  );
}

function Prose({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let k = 0;
  const flushPara = () => {
    if (para.length) { blocks.push(<p key={`b${k++}`}>{inline(para.join(" "), `p${k}-`)}</p>); para = []; }
  };
  const flushList = () => {
    if (!list.length) return;
    const items = list.map((it, i) => <li key={i}>{inline(it, `l${k}-${i}-`)}</li>);
    blocks.push(listType === "ol" ? <ol key={`b${k++}`}>{items}</ol> : <ul key={`b${k++}`}>{items}</ul>);
    list = []; listType = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") { flushPara(); flushList(); continue; }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      blocks.push(h[1].length === 2 ? <h2 key={`b${k++}`}>{inline(h[2], `h${k}-`)}</h2> : <h3 key={`b${k++}`}>{inline(h[2], `h${k}-`)}</h3>);
      continue;
    }
    const b = line.match(/^[-*]\s+(.*)$/);
    if (b) { flushPara(); if (listType === "ol") flushList(); listType = "ul"; list.push(b[1]); continue; }
    const o = line.match(/^\d+\.\s+(.*)$/);
    if (o) { flushPara(); if (listType === "ul") flushList(); listType = "ol"; list.push(o[1]); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return <div className="bn-doc">{blocks}</div>;
}

export function BoardNarrative() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await generateBoardNarrative();
      if (res.ok) {
        setText(res.text);
        setEditing(false);
        setGeneratedAt(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
      } else {
        setError(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const savePdf = () => {
    setEditing(false); // always print the rendered document, never the raw editor
    setTimeout(() => window.print(), 80);
  };

  const btn = "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2";

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
          {loading ? "Drafting…" : text ? "Regenerate" : "Generate board narrative"}
        </button>
        {text && !loading && (
          <>
            <button type="button" onClick={savePdf} className={btn}>
              <FileDown size={14} aria-hidden /> Save as PDF
            </button>
            <button type="button" onClick={() => setEditing((v) => !v)} className={btn}>
              {editing ? <><Eye size={14} aria-hidden /> Preview</> : <><Pencil size={14} aria-hidden /> Edit</>}
            </button>
            <button type="button" onClick={copy} className={btn}>
              {copied ? <Check size={14} className="text-ok" aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        )}
        <span className="text-[11px] text-ink-faint">Drafted from the live portfolio. Review and edit before sharing.</span>
      </div>

      {error && (
        <div className="no-print flex items-center gap-2 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">
          <TriangleAlert size={16} className="shrink-0 text-risk" aria-hidden /> {error}
        </div>
      )}

      {loading && !text && (
        <div className="no-print rounded-xl border border-border bg-surface p-6 text-sm text-ink-muted">
          Reading the live EBITDA build, initiative pace, 2026 goals, and CIM risk exposure, then writing the update…
        </div>
      )}

      {text && editing && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={26}
          spellCheck={false}
          className="no-print w-full rounded-xl border border-border bg-surface p-5 font-mono text-[13px] leading-relaxed text-ink outline-none transition-colors focus:border-navy"
          aria-label="Board narrative source (editable markdown)"
        />
      )}

      {text && !editing && (
        <article className="bn-card rounded-xl border border-border bg-surface px-8 py-7 shadow-sm">
          {/* Branded document header (also serves as the PDF masthead). */}
          <header className="mb-6 flex items-end justify-between gap-4 border-b-2 border-navy/25 pb-4">
            <Image src="/awayday-logo.png" alt="Awayday" width={475} height={101} className="h-7 w-auto" priority />
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold text-navy-deep">Strategic Initiatives · Board Update</p>
              <p className="text-[11px] text-ink-faint">
                {generatedAt ? `As of ${generatedAt} · ` : ""}Confidential · for Awayday leadership
              </p>
            </div>
          </header>
          <Prose text={text} />
        </article>
      )}
    </div>
  );
}
