import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MA_INBOUND_NOTE,
  MA_INBOUNDS,
  MA_PIPELINE,
  MA_SPEED,
  MA_TUCK_INS,
  MA_YTD,
  SEPT_CLOSES,
} from "../_mock/review-detail";
import { DataTable } from "./data-table";
import { fmtInt, Meter, Stat } from "./stat";

function ClosedDeals() {
  const units = SEPT_CLOSES.reduce((a, d) => a + d.units, 0);
  const ebitda = SEPT_CLOSES.reduce((a, d) => a + d.ebitdaM, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Deals closed YTD" value={MA_YTD.deals} sub={`2026 goal ${MA_YTD.goalDeals} deals`} />
        <Stat label="Units" value={fmtInt(MA_YTD.units)} />
        <Stat label="Acquired EBITDA" value={`$${MA_YTD.ebitdaM}M`} sub={`2026 goal $${MA_YTD.goalEbitdaM}M`} />
        <Stat label="Multiple" value={MA_YTD.multipleTotal} sub={`${MA_YTD.multipleSynergized} synergized`} />
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-ink">September closes</p>
        <DataTable
          minWidth="32rem"
          columns={[
            { key: "deal", label: "Deal" },
            { key: "kind", label: "Type", align: "left" },
            { key: "units", label: "Units", numeric: true },
            { key: "ebitda", label: "EBITDA", numeric: true },
            { key: "multiple", label: "Multiple", numeric: true },
          ]}
          rows={[
            ...SEPT_CLOSES.map((d) => ({
              id: d.name,
              cells: {
                deal: (
                  <>
                    {d.name}
                    {d.mock && <span className="ml-1.5 text-[10px] font-normal text-ink-faint">split mock</span>}
                  </>
                ),
                kind: <Badge variant={d.kind === "Large" ? "default" : "secondary"}>{d.kind}</Badge>,
                units: fmtInt(d.units),
                ebitda: `$${d.ebitdaM.toFixed(1)}M`,
                multiple: d.multiple ?? "n/a",
              },
            })),
            {
              id: "total",
              bold: true,
              cells: {
                deal: `${MA_YTD.septDeals} closes in September`,
                kind: "",
                units: fmtInt(units),
                ebitda: `$${ebitda.toFixed(1)}M`,
                multiple: "",
              },
            },
          ]}
        />
        <p className="mt-2 text-[11px] text-ink-faint">
          The MVP gives the four-deal total (942 units, $6.8M) and Liquid Life in full; the unit and EBITDA split across Sunshine, Stay at 30A and Elysian is invented for the mock.
        </p>
      </div>
    </div>
  );
}

function Pipeline() {
  const totalCount = MA_PIPELINE.reduce((a, s) => a + s.count, 0);
  const totalValue = MA_PIPELINE.reduce((a, s) => a + s.valueM, 0);
  const max = Math.max(...MA_PIPELINE.map((s) => s.valueM));
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {MA_PIPELINE.map((s) => (
          <li key={s.stage} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-ink">{s.stage}</span>
              <span className="tabular text-ink-muted">
                {s.count} deals · ${s.valueM.toFixed(1)}M
              </span>
            </div>
            <Meter value={s.valueM} max={max} label={`${s.stage}: ${s.count} deals, $${s.valueM}M`} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-muted">
        <span className="font-semibold text-ink">
          {totalCount} live opportunities · ${totalValue.toFixed(1)}M
        </span>{" "}
        (EBITDA). {MA_TUCK_INS.recentLois}
      </p>
    </div>
  );
}

function Speed() {
  const { medianLoiToCloseDays: days, targetLow, targetHigh } = MA_SPEED;
  const tuckPct = Math.round((MA_TUCK_INS.deliveredM / MA_TUCK_INS.fy27TargetM) * 100);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Stat label="Median LOI-to-close this year" value={`~${days} days`} sub={`Target ${targetLow} to ${targetHigh} days by December`} />
        <Meter value={days} max={120} band={[targetLow, targetHigh]} tone="risk" label={`~${days} days against a ${targetLow} to ${targetHigh} day target`} />
        <p className="text-[11px] text-ink-faint">Green band is the target range. Speed is the constraint.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Stat
          label="Tuck-in EBITDA delivered"
          value={`$${MA_TUCK_INS.deliveredM}M`}
          sub={`${MA_TUCK_INS.deals} deals this year vs $${MA_TUCK_INS.fy27TargetM}M needed in FY27 (${tuckPct}%)`}
        />
        <Meter value={MA_TUCK_INS.deliveredM} max={MA_TUCK_INS.fy27TargetM} tone="warn" label={`$${MA_TUCK_INS.deliveredM}M of $${MA_TUCK_INS.fy27TargetM}M`} />
        <p className="text-[11px] text-ink-faint">
          FY27 budget ${MA_TUCK_INS.fy27BudgetM}M, stretch ${MA_TUCK_INS.fy27StretchM}M.
        </p>
      </div>
    </div>
  );
}

function Inbounds() {
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        minWidth="26rem"
        columns={[
          { key: "name", label: "Inbound" },
          { key: "metric", label: "Size", align: "left" },
          { key: "ask", label: "Ask", align: "left" },
        ]}
        rows={MA_INBOUNDS.map((i) => ({ id: i.name, cells: { name: i.name, metric: i.metric, ask: i.ask } }))}
      />
      <p className="text-xs text-ink-muted">{MA_INBOUND_NOTE}</p>
    </div>
  );
}

export function MaDetail() {
  return (
    <Card className="bg-surface-2/30">
      <CardHeader>
        <CardTitle>M&amp;A detail</CardTitle>
        <CardDescription>Closed deals, pipeline, speed and big inbounds · M&amp;A Leadership Update, 13 Oct</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="closed" className="gap-4">
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList>
              <TabsTrigger value="closed">Closed</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="speed">Speed and tuck-ins</TabsTrigger>
              <TabsTrigger value="inbounds">Inbounds</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="closed">
            <ClosedDeals />
          </TabsContent>
          <TabsContent value="pipeline">
            <Pipeline />
          </TabsContent>
          <TabsContent value="speed">
            <Speed />
          </TabsContent>
          <TabsContent value="inbounds">
            <Inbounds />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
