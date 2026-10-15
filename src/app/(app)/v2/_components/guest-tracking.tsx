import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GUEST } from "../_mock/review-detail";
import { DataTable, Delta } from "./data-table";
import { Meter, Stat } from "./stat";

export function GuestTracking() {
  const pctShops = Math.round((GUEST.shopsAtGoal / GUEST.shopsTotal) * 100);
  return (
    <Card className="bg-surface-2/30">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Guest review floor tracking
          <Badge variant="warn">
            <AlertTriangle size={11} aria-hidden /> September score not reported
          </Badge>
        </CardTitle>
        <CardDescription>
          Goal {GUEST.goal.toFixed(2)} average, no brand under {GUEST.floor.toFixed(1)} · latest score is August
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="YTD at August" value={GUEST.ytdAugust.toFixed(2)} sub={`Goal ${GUEST.goal.toFixed(2)}`} />
          <Stat label="August month" value={GUEST.augustMonth.toFixed(2)} sub="Below goal" />
          <Stat label="Brands under floor" value={GUEST.underFloor.length} sub={`Floor ${GUEST.floor.toFixed(1)}`} />
          <Stat label="Shops at or above goal" value={`${GUEST.shopsAtGoal} of ${GUEST.shopsTotal}`} sub={`${pctShops}% on a trailing year`} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-ink">Brands under the {GUEST.floor.toFixed(1)} floor (August)</p>
            <DataTable
              minWidth="22rem"
              columns={[
                { key: "brand", label: "Brand" },
                { key: "score", label: "Score", numeric: true },
                { key: "gap", label: "Gap to floor", numeric: true },
              ]}
              rows={GUEST.underFloor.map((b) => ({
                id: b.brand,
                cells: { brand: b.brand, score: b.score.toFixed(2), gap: <Delta value={Number((b.score - GUEST.floor).toFixed(2))} digits={2} /> },
              }))}
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-ink">Shops at or above {GUEST.goal.toFixed(2)}</span>
                <span className="tabular text-ink-muted">
                  {GUEST.shopsAtGoal} of {GUEST.shopsTotal}
                </span>
              </div>
              <Meter value={GUEST.shopsAtGoal} max={GUEST.shopsTotal} tone="ok" label={`${GUEST.shopsAtGoal} of ${GUEST.shopsTotal} shops at or above goal`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-ink">Conduit rollout</span>
                <span className="tabular text-ink-muted">
                  {GUEST.conduit.brandsLive} live of {GUEST.conduit.brandsInRollout} brands in rollout
                </span>
              </div>
              <Meter value={GUEST.conduit.brandsLive} max={GUEST.conduit.brandsInRollout} label={`${GUEST.conduit.brandsLive} of ${GUEST.conduit.brandsInRollout} brands live`} />
              <p className="text-[11px] leading-4 text-ink-muted">
                {GUEST.conduit.wave2}. {GUEST.conduit.note}
              </p>
            </div>
            <p className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-ink">{GUEST.septemberNote}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
