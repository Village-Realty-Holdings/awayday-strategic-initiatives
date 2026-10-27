import { Badge } from "@/components/ui/badge";
import { DataTable } from "./data-table";

export type DefinitionRow = {
  id: string;
  name: string;
  metricKey: string;
  unit: string | null;
  target: string | null;
  sourceType: string;
  area: string | null;
  latestPeriod: string | null;
};

const SOURCE_LABEL: Record<string, string> = { SHAREPOINT_EXCEL: "Finance file", SNOWFLAKE: "Snowflake", MANUAL: "Entered by hand" };

/** Every metric the review can show, from the KPI definitions in the database. */
export function DefinitionsView({ rows }: { rows: DefinitionRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">No metrics are defined yet.</p>;
  }
  return (
    <DataTable
      minWidth="48rem"
      columns={[
        { key: "name", label: "Metric" },
        { key: "area", label: "Area", align: "left" },
        { key: "unit", label: "Unit", align: "left" },
        { key: "target", label: "Target", align: "left" },
        { key: "source", label: "Source", align: "left" },
        { key: "latest", label: "Latest data", align: "left" },
      ]}
      rows={rows.map((r) => ({
        id: r.id,
        cells: {
          name: (
            <span>
              {r.name}
              <span className="block font-mono text-[10px] font-normal text-ink-faint">{r.metricKey}</span>
            </span>
          ),
          area: r.area ?? "Company-wide",
          unit: r.unit ?? "—",
          target: r.target || "Not set",
          source: <Badge variant="secondary">{SOURCE_LABEL[r.sourceType] ?? r.sourceType}</Badge>,
          latest: r.latestPeriod ?? <span className="text-ink-faint">No values yet</span>,
        },
      }))}
    />
  );
}
