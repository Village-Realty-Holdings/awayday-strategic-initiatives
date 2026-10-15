// Mock data-input registry for the admin "Data inputs" page. In the real tool
// these are the monthly files and syncs that feed the review numbers. Source
// names come from the MVP "Sources" list; load dates and row counts are invented.

export type DataSourceKind = "FILE" | "SYNC";
export type DataSourceStatus = "LOADED" | "DRAFT" | "PENDING";

export type DataSource = {
  id: string;
  name: string;
  /** Name of the file or model last loaded. */
  artifact: string;
  kind: DataSourceKind;
  owner: string;
  cadence: string;
  feeds: string[];
  /** ISO date of the last load, or null if the month is still waiting. */
  lastLoaded: string | null;
  lastLoadedBy: string;
  status: DataSourceStatus;
  rows: number;
  note?: string;
};

export const DATA_SOURCES: DataSource[] = [
  {
    id: "finance-flash",
    name: "Finance Flash Results",
    artifact: "Awayday 2026-09 Results (Internal), Flash P&L vFinal 12 Oct",
    kind: "FILE",
    owner: "FP&A",
    cadence: "Monthly, after close",
    feeds: ["P&L and KPIs", "LTM lender EBITDA", "NOI by region and shop", "Pillar headline numbers"],
    lastLoaded: "2026-10-12",
    lastLoadedBy: "Hannah (FP&A)",
    status: "LOADED",
    rows: 412,
  },
  {
    id: "shop-ranking",
    name: "Shop Ranking Report",
    artifact: "2026-09 Shop Ranking Report vFinal",
    kind: "FILE",
    owner: "FP&A",
    cadence: "Monthly",
    feeds: ["LTM shop and region ranks", "Shops furthest under NOI budget"],
    lastLoaded: "2026-10-12",
    lastLoadedBy: "Hannah (FP&A)",
    status: "LOADED",
    rows: 64,
  },
  {
    id: "national-financial-review",
    name: "National Financial Review",
    artifact: "2026-09 National Financial Review vDraft",
    kind: "FILE",
    owner: "Finance",
    cadence: "Monthly",
    feeds: ["TRevPAR vs market", "ORM scorecard (LTM churn)"],
    lastLoaded: "2026-10-13",
    lastLoadedBy: "Jazzy",
    status: "DRAFT",
    rows: 58,
    note: "Draft version loaded. Replace with the final when Finance publishes it.",
  },
  {
    id: "ma-update",
    name: "M&A update",
    artifact: "M&A Leadership Update 13 Oct 2026",
    kind: "FILE",
    owner: "M&A (Curt Stark)",
    cadence: "Monthly, before the ELT review",
    feeds: ["Closed deals", "Pipeline and LOIs", "Tuck-in tracker"],
    lastLoaded: "2026-10-13",
    lastLoadedBy: "Curt Stark",
    status: "LOADED",
    rows: 38,
  },
  {
    id: "awayday-dna",
    name: "AwayDNA",
    artifact: "dbt Semantic Layer: TRevPAR, ADR, paid occupancy, unit adds, unit churn, units by brand",
    kind: "SYNC",
    owner: "Data team",
    cadence: "Daily sync (no upload)",
    feeds: ["TRevPAR by month (PMS basis)", "Brand churn and unit adds", "Unit base (bookable, not bookable, inactive)"],
    lastLoaded: "2026-10-13",
    lastLoadedBy: "Automated sync",
    status: "LOADED",
    rows: 18_240,
  },
];
