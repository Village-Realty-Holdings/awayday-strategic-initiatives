import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/review/data-table";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { comparePeriods, PUBLICATION_APPROVED } from "@/lib/kpi";
import { loadKpiJoinedRows } from "@/lib/kpi-joined";
import { BASIS_LABEL, TIME_LABEL } from "@/lib/review-kpi";
import { fmtLong, isoDay, periodLabel } from "@/lib/review-model";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { SHAREPOINT_EXCEL: "SharePoint Excel", SNOWFLAKE: "Snowflake", MANUAL: "Entered by hand" };

// Every KPI source in the database: the documents observations were loaded
// from, and each metric's configured source with its latest data.
export default async function DataSourcesPage() {
  await requireAdmin();
  const [observations, definitions, joined] = await Promise.all([
    prisma.kpiObservation.findMany({
      select: {
        reportingPeriod: true,
        observedAt: true,
        quality: true,
        publicationState: true,
        comparisonBasis: true,
        timeBasis: true,
        sourceDocumentId: true,
        sourceDocumentName: true,
        sourceCategory: true,
        kpi: { select: { metricKey: true } },
      },
    }),
    prisma.kpiDefinition.findMany({
      orderBy: [{ sourceType: "asc" }, { name: "asc" }],
      include: {
        strategicArea: { select: { name: true } },
        observations: { select: { reportingPeriod: true, observedAt: true, publicationState: true } },
      },
    }),
    loadKpiJoinedRows(),
  ]);

  type DocRow = {
    key: string;
    name: string;
    category: string | null;
    period: string;
    rows: number;
    approved: number;
    metrics: Set<string>;
    bases: Set<string>;
    issues: number;
    lastObserved: Date;
  };
  const docs = new Map<string, DocRow>();
  for (const o of observations) {
    const name = o.sourceDocumentName ?? o.sourceDocumentId ?? "Unknown document";
    const key = `${o.sourceDocumentId ?? name}|${o.reportingPeriod}`;
    const doc = docs.get(key) ?? { key, name, category: o.sourceCategory, period: o.reportingPeriod, rows: 0, approved: 0, metrics: new Set(), bases: new Set(), issues: 0, lastObserved: o.observedAt };
    doc.rows += 1;
    if (o.publicationState === "APPROVED") doc.approved += 1;
    if (o.quality !== "VALID") doc.issues += 1;
    doc.metrics.add(o.kpi.metricKey);
    doc.bases.add(`${o.timeBasis ?? "?"} ${o.comparisonBasis ?? "?"}`.toLowerCase());
    if (o.observedAt > doc.lastObserved) doc.lastObserved = o.observedAt;
    docs.set(key, doc);
  }
  const docRows = [...docs.values()].sort((a, b) => comparePeriods(b.period, a.period) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Data sources</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Where the review&apos;s figures come from: the documents loaded into the KPI tables, and the source configured for each metric.
        </p>
      </header>

      <Card className="gap-0 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Loaded documents</h2>
        {docRows.length > 0 ? (
          <DataTable
            minWidth="52rem"
            columns={[
              { key: "doc", label: "Document" },
              { key: "period", label: "Month", align: "left" },
              { key: "rows", label: "Values", numeric: true },
              { key: "metrics", label: "Metrics", numeric: true },
              { key: "bases", label: "Bases", align: "left" },
              { key: "state", label: "State", align: "left" },
              { key: "observed", label: "Last loaded", align: "left" },
            ]}
            rows={docRows.map((d) => ({
              id: d.key,
              cells: {
                doc: (
                  <span>
                    {d.name}
                    {d.category && <span className="block text-note font-normal text-ink-faint">{d.category}</span>}
                  </span>
                ),
                period: periodLabel(d.period),
                rows: d.rows,
                metrics: d.metrics.size,
                bases: [...d.bases].sort().join(", "),
                state: (
                  <span className="flex flex-wrap gap-1">
                    <Badge variant={d.approved === d.rows ? "ok" : "warn"}>{d.approved} of {d.rows} approved</Badge>
                    {d.issues > 0 && <Badge variant="warn">{d.issues} not valid</Badge>}
                  </span>
                ),
                observed: fmtLong(isoDay(d.lastObserved)),
              },
            }))}
          />
        ) : (
          <p className="text-xs text-ink-faint">No KPI values have been loaded yet.</p>
        )}
      </Card>

      <Card className="gap-0 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Metrics and their sources</h2>
        <DataTable
          minWidth="52rem"
          columns={[
            { key: "metric", label: "Metric" },
            { key: "source", label: "Source", align: "left" },
            { key: "identifier", label: "Identifier", align: "left" },
            { key: "area", label: "Area", align: "left" },
            { key: "values", label: "Values", numeric: true },
            { key: "latest", label: "Latest month", align: "left" },
          ]}
          rows={definitions.map((d) => {
            const latest = d.observations.map((o) => o.reportingPeriod).sort((a, b) => comparePeriods(b, a))[0];
            return {
              id: d.id,
              cells: {
                metric: (
                  <span>
                    {d.name}
                    <span className="block font-mono text-micro font-normal text-ink-faint">{d.metricKey}</span>
                  </span>
                ),
                source: <Badge variant="secondary">{SOURCE_LABEL[d.sourceType] ?? d.sourceType}</Badge>,
                identifier: d.sourceIdentifier ? <span className="font-mono text-note">{d.sourceIdentifier}</span> : <span className="text-ink-faint">—</span>,
                area: d.strategicArea?.name ?? "Company-wide",
                values: d.observations.length,
                latest: latest ? periodLabel(latest) : <span className="text-ink-faint">No values yet</span>,
              },
            };
          })}
        />
      </Card>
      <Card className="gap-0 p-5">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">KPI values (joined)</h2>
          <Badge variant="warn">Temporary</Badge>
        </div>
        <p className="mb-3 text-xs text-ink-faint">
          Stopgap raw view of every KPI definition joined to its observations and revision history. It will be replaced.
        </p>
        <DataTable
          minWidth="84rem"
          columns={[
            { key: "metric", label: "Metric" },
            { key: "area", label: "Area", align: "left" },
            { key: "period", label: "Month", align: "left" },
            { key: "basis", label: "Basis", align: "left" },
            { key: "value", label: "Value", numeric: true },
            { key: "state", label: "State", align: "left" },
            { key: "rev", label: "Rev", numeric: true },
            { key: "source", label: "Source", align: "left" },
            { key: "loaded", label: "Loaded", align: "left" },
            { key: "details", label: "Details", align: "left", className: "min-w-72" },
          ]}
          rows={joined.map((r) => {
            const o = r.observation;
            const metric = (
              <span>
                {r.name}
                <span className="block font-mono text-micro font-normal text-ink-faint">{r.metricKey}</span>
              </span>
            );
            if (!o) {
              return {
                id: r.id,
                cells: { metric, area: r.area, value: <span className="text-ink-faint">No values yet</span> },
              };
            }
            const facts: [string, string | number | null][] = [
              ["Target", r.target],
              ["Reporting scope", o.reportingScope],
              ["Entity", [o.entityScope, o.entityId].filter(Boolean).join(" · ") || null],
              ["Derivation", o.valueDerivation],
              ["Authority rank", o.authorityRank],
              ["Observed", fmtLong(isoDay(o.observedAt))],
              ["Raw value", o.value],
            ];
            return {
              id: r.id,
              cells: {
                metric,
                area: r.area,
                period: periodLabel(o.reportingPeriod),
                basis: `${TIME_LABEL[o.timeBasis ?? ""] ?? o.timeBasis ?? "?"} · ${BASIS_LABEL[o.comparisonBasis ?? ""] ?? o.comparisonBasis ?? "?"}`,
                value: <span title={o.value}>{o.formattedValue}</span>,
                state: (
                  <span className="flex flex-wrap gap-1">
                    <Badge variant={o.publicationState === PUBLICATION_APPROVED ? "ok" : "secondary"}>{o.publicationState.toLowerCase()}</Badge>
                    {o.quality !== "VALID" && <Badge variant="warn">{o.quality.toLowerCase()}</Badge>}
                  </span>
                ),
                rev: o.revision,
                source: (
                  <span>
                    {o.sourceDocumentName ?? "Unknown document"}
                    {o.sourceDocumentVersion && <span className="text-ink-faint"> · v{o.sourceDocumentVersion}</span>}
                    {o.sourceLocation && <span className="block font-mono text-micro text-ink-faint">{o.sourceLocation}</span>}
                  </span>
                ),
                loaded: fmtLong(isoDay(o.refreshedAt)),
                details: (
                  <details className="text-note">
                    <summary className="cursor-pointer text-ink-muted">More</summary>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                      {facts.map(([label, value]) => (
                        <div key={label} className="contents">
                          <dt className="text-ink-faint">{label}</dt>
                          <dd>{value ?? "—"}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-ink-faint">History</p>
                    <ul>
                      {o.revisions.map((h) => (
                        <li key={h.revision} className="tabular">
                          r{h.revision}: {h.value} · {h.publicationState.toLowerCase()} · {fmtLong(isoDay(h.recordedAt))}
                        </li>
                      ))}
                      {o.revisions.length === 0 && <li className="text-ink-faint">No history recorded</li>}
                    </ul>
                  </details>
                ),
              },
            };
          })}
        />
      </Card>
    </div>
  );
}
