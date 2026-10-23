// SNAPSHOT of the "Linked Strategic Initiatives" checklist markup that
// src/components/cim-form.tsx and groups-manager.tsx each inlined before the
// shadcn Checkbox migration, kept only for /dev/comparison.
import { Label } from "@/components/ui/label";

export function LegacyInitiativeChecklist({
  name,
  initiatives,
  defaultSelected = [],
}: {
  name: string;
  initiatives: { id: string; code: string; name: string }[];
  defaultSelected?: string[];
}) {
  const linkedSet = new Set(defaultSelected);
  return (
    <div className="grid max-h-56 grid-cols-1 gap-x-4 gap-y-1.5 overflow-y-auto rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3">
      {initiatives.length === 0 && <p className="text-xs text-ink-faint">No initiatives yet.</p>}
      {initiatives.map((i) => (
        <Label key={i.id} className="flex items-center gap-2 text-xs font-normal text-ink">
          <input
            type="checkbox"
            name={name}
            value={i.id}
            defaultChecked={linkedSet.has(i.id)}
            className="h-3.5 w-3.5 shrink-0 rounded border-border accent-navy"
          />
          <span className="truncate" title={`${i.code} · ${i.name}`}>
            <span className="tabular text-ink-faint">{i.code}</span> {i.name}
          </span>
        </Label>
      ))}
    </div>
  );
}
