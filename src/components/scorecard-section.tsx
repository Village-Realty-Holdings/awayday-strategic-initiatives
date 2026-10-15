"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import type { Goal } from "@/lib/sources";
import { Button } from "@/components/ui/button";
import { ScorecardEditor } from "@/components/scorecard-editor";
import type { CodeOption } from "@/components/code-multiselect";

// Inline scorecard: shows the read-only table (passed as children) and, for
// editors, an Edit button that swaps it for the editor in place. No page nav.
export function ScorecardSection({
  goals,
  editable,
  siOptions,
  cimOptions,
  children,
}: {
  goals: Goal[];
  editable: boolean;
  siOptions: CodeOption[];
  cimOptions: CodeOption[];
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Financial &amp; Operating Scorecard</h2>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((v) => !v)}
            className="px-2.5 py-1"
          >
            {editing ? <><X size={12} aria-hidden /> Close</> : <><Pencil size={12} aria-hidden /> Edit</>}
          </Button>
        )}
      </div>
      <p className="mb-3 mt-1 max-w-3xl text-xs text-ink-faint">
        The measurable KPIs from the National Financial Review. Each row is owned, tied to a CIM bucket, and pushed by named SIs.
      </p>
      {editing ? (
        <ScorecardEditor goals={goals} siOptions={siOptions} cimOptions={cimOptions} onDone={() => setEditing(false)} />
      ) : (
        children
      )}
    </section>
  );
}
