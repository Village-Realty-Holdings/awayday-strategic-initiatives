import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/review/data-table";
import { requireAdmin } from "@/lib/session";
import { resolvePeriod } from "@/lib/review-data";
import { getReviewedReport } from "@/lib/review-report-data";
import { periodLabel } from "@/lib/review-model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review data quality — Awayday" };

const STATE_LABEL: Record<string, string> = {
  loaded: "Compared from loaded budget or prior-year observations",
  "no-budget-or-prior-year": "Value loaded; no budget or prior-year observation for this population",
};

/**
 * Admin-only. The executive page shows the reviewed comparison the report
 * printed; when none was recorded for a month it says so in one plain sentence.
 * The technical detail — which exact observation identity is missing, and
 * whether the reviewed comparison has been recorded — belongs here, where it can
 * be acted on without confusing the executive summary.
 */
export default async function ReviewDataQualityPage() {
  await requireAdmin();
  const { id: period } = await resolvePeriod(null, "review");
  const report = await getReviewedReport(period);
  const reviewedCount = report.execCards.filter((card) => (card.reviewed?.lines.length ?? 0) > 0).length;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Review data quality</h1>
        <p className="mt-1 text-sm text-ink-muted">
          What the executive summary can and cannot compare for {periodLabel(period)}, and why. A reviewed comparison is the statement the report
          printed; a missing identity is an observation this application does not hold, named exactly so it can be loaded or recorded. Neither changes a
          published observation or a status.
        </p>
      </div>

      <Card className="gap-0 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Executive summary cards · {periodLabel(period)}</p>
          <Badge variant={reviewedCount === report.execCards.length ? "secondary" : "outline"}>
            {reviewedCount} of {report.execCards.length} with a reviewed comparison
          </Badge>
        </div>
        <DataTable
          minWidth="52rem"
          columns={[
            { key: "card", label: "Card" },
            { key: "value", label: "Value" },
            { key: "state", label: "Comparison state" },
            { key: "reviewed", label: "Reviewed comparison" },
            { key: "missing", label: "Missing identities" },
          ]}
          rows={report.execCards.map((card) => ({
            id: card.id,
            cells: {
              card: card.title,
              value: card.value ?? "—",
              state: STATE_LABEL[card.comparisonState] ?? card.comparisonState,
              reviewed:
                card.reviewed && card.reviewed.lines.length > 0
                  ? `${card.reviewed.lines.map((line) => line.text).join(" · ")}${card.reviewed.sourceDocumentName ? ` (${card.reviewed.sourceDocumentName})` : ""}`
                  : "None recorded for this month",
              missing: card.missingIdentities.length > 0 ? card.missingIdentities.join(" · ") : "—",
            },
          }))}
        />
      </Card>

      <Card className="gap-2 p-5">
        <p className="text-sm font-semibold text-ink">Reviewed metrics not linked to a pillar</p>
        <p className="text-sm text-ink-muted">
          {report.counts.unlinkedMetrics > 0
            ? `${report.counts.unlinkedMetrics} reviewed ${report.counts.unlinkedMetrics === 1 ? "metric is" : "metrics are"} not linked to a pillar, so ${report.counts.unlinkedMetrics === 1 ? "it appears" : "they appear"} in the report tables and this page but not in a scorecard.`
            : "Every reviewed metric for this month is linked to a pillar."}{" "}
          Linking is a reviewed decision: no relationship is inferred here.
        </p>
      </Card>
    </div>
  );
}
