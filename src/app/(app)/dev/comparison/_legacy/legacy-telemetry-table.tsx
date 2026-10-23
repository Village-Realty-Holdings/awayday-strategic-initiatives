// SNAPSHOT of the Table helper in src/app/(app)/settings/admin/ai-telemetry/page.tsx
// before the shadcn Table migration, kept only for /dev/comparison.

export function LegacyTelemetryTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap py-1.5 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {cells.map((c, j) => (
                <td key={j} className={`whitespace-nowrap py-1.5 pr-4 ${j === 0 ? "text-ink" : "tabular-nums text-ink-muted"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
