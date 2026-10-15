import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHURN_LTM,
  CHURN_LTM_NOTE,
  CHURN_SEPT,
  CHURN_SEPT_NOTE,
  SHOPS_UNDER_NOI,
  TREVPAR_BEATING,
  TREVPAR_CAPTION,
  TREVPAR_TRAILING,
  UNIT_ADDS_LOW,
  UNIT_ADDS_NOTE,
  UNIT_ADDS_TOP,
  type ChurnRow,
  type MarketRow,
} from "../_mock/review-detail";
import { DataTable, Delta } from "./data-table";
import { TrevparMonthlyChart } from "./review-charts";

const TAB_SCROLL = "-mx-1 overflow-x-auto px-1";

function churnRows(list: ChurnRow[]) {
  return list.map((r) => ({
    id: r.brand,
    cells: {
      brand: (
        <>
          {r.brand}
          {r.both && (
            <Badge variant="risk" className="ml-1.5">
              On both lists
            </Badge>
          )}
        </>
      ),
      rate: `${r.rate}%`,
      detail: r.detail ?? "",
    },
  }));
}

export function ChurnLists() {
  const columns = [
    { key: "brand", label: "Brand" },
    { key: "rate", label: "Annualized churn", numeric: true },
    { key: "detail", label: "Note", align: "left" as const },
  ];
  return (
    <Card className="bg-surface-2/30">
      <CardHeader>
        <CardTitle>Brand churn, worst lists</CardTitle>
        <CardDescription>Two views that will not match one to one: September (AwayDNA) and last twelve months (ORM scorecard)</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sept" className="gap-3">
          <div className={TAB_SCROLL}>
            <TabsList>
              <TabsTrigger value="sept">September · AwayDNA</TabsTrigger>
              <TabsTrigger value="ltm">LTM · ORM scorecard</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="sept" className="flex flex-col gap-2">
            <DataTable columns={columns} rows={churnRows(CHURN_SEPT)} minWidth="26rem" />
            <p className="text-[11px] text-ink-faint">{CHURN_SEPT_NOTE}</p>
          </TabsContent>
          <TabsContent value="ltm" className="flex flex-col gap-2">
            <DataTable columns={columns} rows={churnRows(CHURN_LTM)} minWidth="26rem" />
            <p className="text-[11px] text-ink-faint">{CHURN_LTM_NOTE}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function marketRows(list: MarketRow[]) {
  return list.map((r) => ({
    id: r.brand,
    cells: {
      brand: r.brand,
      trevpar: `${r.trevpar > 0 ? "+" : ""}${r.trevpar}%`,
      market: `${r.market > 0 ? "+" : ""}${r.market}%`,
      gap: <Delta value={r.trevpar - r.market} suffix=" pts" />,
    },
  }));
}

export function TrevparDetail() {
  const columns = [
    { key: "brand", label: "Brand" },
    { key: "trevpar", label: "TRevPAR vs PY", numeric: true },
    { key: "market", label: "Market", numeric: true },
    { key: "gap", label: "Gap to market", numeric: true },
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="bg-surface-2/30">
        <CardHeader>
          <CardTitle>TRevPAR by month, Aug-25 to Sep-26</CardTitle>
          <CardDescription>AwayDNA, PMS basis · navy bar is the real September figure, teal bars are mock shape</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <TrevparMonthlyChart />
          <p className="text-[11px] leading-4 text-ink-faint">{TREVPAR_CAPTION}</p>
        </CardContent>
      </Card>
      <Card className="bg-surface-2/30">
        <CardHeader>
          <CardTitle>TRevPAR against market, by brand</CardTitle>
          <CardDescription>September growth vs PY and the market comparison (National Financial Review, draft)</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="beating" className="gap-3">
            <div className={TAB_SCROLL}>
              <TabsList>
                <TabsTrigger value="beating">Beating market</TabsTrigger>
                <TabsTrigger value="trailing">Trailing market</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="beating">
              <DataTable columns={columns} rows={marketRows(TREVPAR_BEATING)} minWidth="26rem" />
            </TabsContent>
            <TabsContent value="trailing">
              <DataTable columns={columns} rows={marketRows(TREVPAR_TRAILING)} minWidth="26rem" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export function UnitAddsLists() {
  return (
    <Card className="bg-surface-2/30">
      <CardHeader>
        <CardTitle>Unit adds by brand, September</CardTitle>
        <CardDescription>AwayDNA brand counts</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="top" className="gap-3">
          <div className={TAB_SCROLL}>
            <TabsList>
              <TabsTrigger value="top">Adding most</TabsTrigger>
              <TabsTrigger value="low">Adding one or none</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="top">
            <DataTable
              minWidth="18rem"
              columns={[
                { key: "brand", label: "Brand" },
                { key: "adds", label: "Units added", numeric: true },
              ]}
              rows={UNIT_ADDS_TOP.map((r) => ({ id: r.brand, cells: { brand: r.brand, adds: r.adds ?? "" } }))}
            />
          </TabsContent>
          <TabsContent value="low">
            <DataTable
              minWidth="18rem"
              columns={[
                { key: "brand", label: "Brand" },
                { key: "adds", label: "Units added", numeric: true },
              ]}
              rows={UNIT_ADDS_LOW.map((r) => ({ id: r.brand, cells: { brand: r.brand, adds: "0 to 1" } }))}
            />
          </TabsContent>
        </Tabs>
        <p className="mt-2 text-[11px] text-ink-faint">{UNIT_ADDS_NOTE}</p>
      </CardContent>
    </Card>
  );
}

export function ShopsUnderBudget() {
  return (
    <Card className="bg-surface-2/30">
      <CardHeader>
        <CardTitle>Shops furthest under NOI budget, YTD</CardTitle>
        <CardDescription>Shop Ranking Report, vFinal</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          minWidth="18rem"
          columns={[
            { key: "shop", label: "Shop" },
            { key: "variance", label: "NOI vs budget", numeric: true },
          ]}
          rows={SHOPS_UNDER_NOI.map((s) => ({
            id: s.name,
            cells: { shop: s.name, variance: <Delta value={s.varianceM} prefix="$" suffix="M" /> },
          }))}
        />
      </CardContent>
    </Card>
  );
}
