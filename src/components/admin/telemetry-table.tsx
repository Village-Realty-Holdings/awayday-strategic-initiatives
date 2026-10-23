import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// A cell counts as numeric when it is a count, money, duration or percentage
// ("12", "$0.42", "850ms", "1.2s", "98%"). Blank cells don't vote.
const NUMERIC = /^[-+]?\$?[\d.,]+\s?(ms|s|%|K|M)?$/;

// Generic report table for the AI telemetry page: string cells, with columns
// whose every value is numeric right-aligned in tabular figures.
export function TelemetryTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const numeric = headers.map((_, j) => {
    const vals = rows.map((r) => r[j]).filter(Boolean);
    return vals.length > 0 && vals.every((v) => NUMERIC.test(v));
  });
  return (
    <Table containerClassName="mt-3 rounded-lg border border-border" className="text-sm">
      <TableHeader>
        <TableRow>
          {headers.map((h, j) => (
            <TableHead key={h} className={cn(numeric[j] && "text-right")}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((cells, i) => (
          <TableRow key={i}>
            {cells.map((c, j) => (
              <TableCell
                key={j}
                className={cn(
                  "whitespace-nowrap py-1.5",
                  j === 0 ? "text-ink" : "text-ink-muted",
                  numeric[j] && "tabular text-right",
                )}
              >
                {c || <span className="text-ink-faint">—</span>}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
