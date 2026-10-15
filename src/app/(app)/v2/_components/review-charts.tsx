"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LTM_BRIDGE,
  LTM_GOAL_2026,
  LTM_SERIES,
  REGION_NOI,
  TREVPAR_MONTHLY,
  type NoiVariance,
} from "../_mock/review-detail";

const NAVY = "var(--color-navy)";
const TEAL = "var(--color-teal)";
const GOLD_DEEP = "var(--color-gold-deep)";
const OK = "var(--color-ok)";
const RISK = "var(--color-risk)";

const AXIS_TICK = { fontSize: 11 };

function signedM(v: number): string {
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}$${Math.abs(v).toFixed(1)}M`;
}

// ----------------------------------------------------------- LTM EBITDA

const ltmLineConfig = {
  pf: { label: "LTM pro forma lender EBITDA", color: NAVY },
  base: { label: "Base business Adj. EBITDA", color: GOLD_DEEP },
} satisfies ChartConfig;

const waterfallConfig = {
  value: { label: "EBITDA ($M)" },
} satisfies ChartConfig;

type WaterfallRow = { name: string; offset: number; value: number; fill: string; tip: string };

const WATERFALL: WaterfallRow[] = [
  { name: LTM_BRIDGE.start.label, offset: 0, value: LTM_BRIDGE.start.value, fill: NAVY, tip: `$${LTM_BRIDGE.start.value}M` },
  {
    name: "Base business",
    offset: LTM_BRIDGE.start.value,
    value: LTM_BRIDGE.baseGrowth.value,
    fill: GOLD_DEEP,
    tip: `+$${LTM_BRIDGE.baseGrowth.value}M (${LTM_BRIDGE.baseGrowth.note})`,
  },
  {
    name: "Acquired, PI, run-rate",
    offset: LTM_BRIDGE.start.value + LTM_BRIDGE.baseGrowth.value,
    value: LTM_BRIDGE.other.value,
    fill: TEAL,
    tip: `+$${LTM_BRIDGE.other.value}M (derived)`,
  },
  { name: LTM_BRIDGE.end.label, offset: 0, value: LTM_BRIDGE.end.value, fill: NAVY, tip: `$${LTM_BRIDGE.end.value}M` },
];

export function LtmEbitdaChart() {
  return (
    <Tabs defaultValue="bridge" className="gap-3">
      <TabsList>
        <TabsTrigger value="bridge">Bridge</TabsTrigger>
        <TabsTrigger value="monthly">By month</TabsTrigger>
      </TabsList>
      <TabsContent value="bridge">
        <ChartContainer config={waterfallConfig} className="aspect-auto h-64 w-full">
          <BarChart data={WATERFALL} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={36} tick={AXIS_TICK} tickFormatter={(v: number) => `$${v}`} domain={[0, 150]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(_v, _n, item) => (
                    <span className="tabular">
                      {(item.payload as WaterfallRow).name}: {(item.payload as WaterfallRow).tip}
                    </span>
                  )}
                />
              }
            />
            {/* Invisible spacer that floats the delta bars. Rows carry `fill`, so hide it with an empty shape rather than a transparent fill. */}
            <Bar dataKey="offset" stackId="w" shape={() => <g />} isAnimationActive={false} tooltipType="none" />
            <Bar dataKey="value" stackId="w" radius={3} isAnimationActive={false}>
              <LabelList dataKey="value" position="top" className="fill-ink text-[11px]" formatter={(v: unknown) => `$${v}M`} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </TabsContent>
      <TabsContent value="monthly">
        <ChartContainer config={ltmLineConfig} className="aspect-auto h-64 w-full">
          <LineChart data={LTM_SERIES} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={36} tick={AXIS_TICK} tickFormatter={(v: number) => `$${v}`} domain={[60, 140]} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => <span className="tabular">{ltmLineConfig[n as keyof typeof ltmLineConfig]?.label ?? n}: ${Number(v).toFixed(1)}M</span>} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <ReferenceLine y={LTM_GOAL_2026} stroke={OK} strokeDasharray="4 4" label={{ value: "2026 goal $120M", position: "insideTopLeft", fontSize: 10, fill: OK }} />
            <Line type="monotone" dataKey="pf" stroke="var(--color-pf)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="base" stroke="var(--color-base)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      </TabsContent>
    </Tabs>
  );
}

// -------------------------------------------------------------- TRevPAR

const trevparConfig = {
  value: { label: "TRevPAR (AwayDNA, PMS)", color: TEAL },
} satisfies ChartConfig;

const TREVPAR_ROWS = TREVPAR_MONTHLY.map((p) => ({ ...p, fill: p.mock ? TEAL : NAVY }));

export function TrevparMonthlyChart() {
  return (
    <ChartContainer config={trevparConfig} className="aspect-auto h-60 w-full">
      <BarChart data={TREVPAR_ROWS} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} minTickGap={8} />
        <YAxis tickLine={false} axisLine={false} width={40} tick={AXIS_TICK} tickFormatter={(v: number) => `$${v}`} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(v, _n, item) => (
                <span className="tabular">
                  {(item.payload as { month: string }).month}: ${Number(v).toFixed(1)}
                  {(item.payload as { mock: boolean }).mock ? " (mock)" : ""}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="value" radius={3} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

// --------------------------------------------------------- region NOI

const regionConfig = {
  varianceM: { label: "NOI vs budget ($M)" },
} satisfies ChartConfig;

export function RegionNoiChart({ data = REGION_NOI }: { data?: NoiVariance[] }) {
  const rows = data.map((r) => ({ ...r, fill: r.varianceM >= 0 ? OK : RISK }));
  return (
    <ChartContainer config={regionConfig} className="aspect-auto h-56 w-full">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}`} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={44} tick={AXIS_TICK} />
        <ReferenceLine x={0} stroke="var(--color-border-strong)" />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(v, _n, item) => (
                <span className="tabular">
                  {(item.payload as { name: string }).name}: {signedM(Number(v))} YTD vs budget
                </span>
              )}
            />
          }
        />
        <Bar dataKey="varianceM" radius={3} isAnimationActive={false}>
          <LabelList dataKey="varianceM" position="right" className="fill-ink text-[11px]" formatter={(v: unknown) => `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(1)}`} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
