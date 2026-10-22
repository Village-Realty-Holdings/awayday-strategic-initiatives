"use client";

// SNAPSHOT of the hand-rolled toggle buttons before the shadcn ToggleGroup
// migration, kept only for /dev/comparison:
//  - the Scorecard / Exposure map switch in src/components/risk-views.tsx
//  - the Working team chips and Value / Non-value switch in
//    src/components/initiative-form.tsx
import { LayoutGrid, ScatterChart } from "lucide-react";

function Toggle({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-default inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
        active ? "bg-navy text-white" : "text-ink-muted hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export function LegacyViewSwitch({ view, onChange }: { view: "scorecard" | "matrix"; onChange: (v: "scorecard" | "matrix") => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs font-medium">
      <Toggle active={view === "scorecard"} onClick={() => onChange("scorecard")} icon={<LayoutGrid size={13} aria-hidden />}>
        Scorecard
      </Toggle>
      <Toggle active={view === "matrix"} onClick={() => onChange("matrix")} icon={<ScatterChart size={13} aria-hidden />}>
        Exposure map
      </Toggle>
    </div>
  );
}

export function LegacyTeamChips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggleTeam = (name: string) => onChange(value.includes(name) ? value.filter((n) => n !== name) : [...value, name]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((name) => {
        const on = value.includes(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => toggleTeam(name)}
            className={`cursor-default rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              on ? "border-navy bg-navy text-white" : "border-border bg-surface text-ink-muted hover:border-navy/50"
            }`}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

export function LegacyValueTypeSwitch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
      {[
        { v: "VALUE", label: "Value" },
        { v: "NON_VALUE", label: "Non-value" },
      ].map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`cursor-default rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === o.v ? "bg-navy text-white" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
