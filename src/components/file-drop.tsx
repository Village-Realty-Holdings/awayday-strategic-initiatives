"use client";

import { useId, useRef, useState } from "react";
import { UploadCloud, FileCheck2 } from "lucide-react";

// The app's one file-pick control: a drop zone that is also a click-to-browse
// button, wrapping a real <input type="file"> so plain <form action> server
// actions keep working unchanged (no JS upload path). Dropping a file assigns
// it to the input via DataTransfer; the surrounding form's submit button
// stays the action, so an accidental drop never uploads anything.
// `multiple` takes several files at once (October 6: a booking file per
// year), keeping only as many as fit under `maxTotalBytes` so the request
// stays under the server action body limit, and saying which were left out.

export function FileDrop({
  name = "file",
  accept,
  required = false,
  label = "Drop a file here or click to browse",
  compact = false,
  className = "",
  multiple = false,
  maxTotalBytes,
}: {
  name?: string;
  accept?: string;
  required?: boolean;
  /** Prompt shown before a file is chosen. */
  label?: string;
  /** Single-line variant for inline forms. */
  compact?: boolean;
  className?: string;
  /** Take several files at once. */
  multiple?: boolean;
  /** With `multiple`: files past this many bytes in total are left out (and named). */
  maxTotalBytes?: number;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [leftOut, setLeftOut] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const assign = (files: FileList | null) => {
    if (!files || files.length === 0 || !inputRef.current) return;
    // Filter to the accept list on drop (the picker enforces it on browse).
    const accepted = Array.from(multiple ? files : [files[0]]).filter((f) => !accept || matchesAccept(f, accept));
    if (accepted.length === 0) {
      setFileName(null);
      setLeftOut(null);
      inputRef.current.value = "";
      return;
    }
    const kept: File[] = [];
    const skipped: string[] = [];
    let total = 0;
    for (const f of accepted) {
      if (maxTotalBytes != null && kept.length > 0 && total + f.size > maxTotalBytes) {
        skipped.push(f.name);
        continue;
      }
      kept.push(f);
      total += f.size;
    }
    const dt = new DataTransfer();
    for (const f of kept) dt.items.add(f);
    inputRef.current.files = dt.files;
    setFileName(kept.length === 1 ? kept[0].name : `${kept.length} files: ${kept.map((f) => f.name).join(", ")}`);
    setLeftOut(skipped.length > 0 ? `Too large to send together, so left out for now: ${skipped.join(", ")}. Upload ${skipped.length === 1 ? "it" : "them"} next.` : null);
  };

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        assign(e.dataTransfer.files);
      }}
      className={
        "flex cursor-pointer flex-wrap items-center gap-2 rounded-md border border-dashed text-xs transition-colors " +
        (over ? "border-navy bg-navy/5 " : fileName ? "border-ok/60 bg-ok/5 " : "border-border bg-surface hover:border-navy/50 hover:bg-surface-2 ") +
        (compact ? "px-2.5 py-1.5 " : "px-3 py-2.5 ") +
        className
      }
    >
      {fileName ? (
        <FileCheck2 size={compact ? 13 : 15} className="shrink-0 text-ok" aria-hidden />
      ) : (
        <UploadCloud size={compact ? 13 : 15} className="shrink-0 text-ink-faint" aria-hidden />
      )}
      <span className={"min-w-0 truncate " + (fileName ? "font-medium text-ink" : "text-ink-muted")}>
        {fileName ?? label}
      </span>
      {leftOut && <span className="basis-full text-[11px] text-warn">{leftOut}</span>}
      <input
        ref={inputRef}
        id={id}
        type="file"
        name={name}
        accept={accept}
        required={required}
        multiple={multiple}
        onChange={(e) => assign(e.target.files)}
        className="sr-only"
      />
    </label>
  );
}

function matchesAccept(file: File, accept: string): boolean {
  const rules = accept.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}
