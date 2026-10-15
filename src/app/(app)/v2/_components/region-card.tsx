import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REGION_NOI } from "../_mock/review-detail";
import { DataTable, Delta } from "./data-table";
import { RegionNoiChart } from "./review-charts";

export function RegionCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Region NOI vs budget, YTD</CardTitle>
        <CardDescription>Shop NOI variance in $M · Flash P&amp;L vFinal. Behind: CO, CH, SC, SW. Ahead: NEFL, NWFL.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <RegionNoiChart />
        <DataTable
          minWidth="14rem"
          columns={[
            { key: "region", label: "Region" },
            { key: "variance", label: "vs budget", numeric: true },
          ]}
          rows={REGION_NOI.map((r) => ({
            id: r.name,
            cells: { region: r.name, variance: <Delta value={r.varianceM} prefix="$" suffix="M" /> },
          }))}
        />
      </CardContent>
    </Card>
  );
}
