// Metric definitions and data notes register. September 2026 content comes from
// the "Definitions and gaps to close before November" list in the MVP doc,
// expanded into structured entries so each basis can be shown side by side.

export type DefinitionKind = "Two bases" | "Derived" | "Method" | "Gap" | "Frame" | "Reference";

export type DefinitionVariant = {
  label: string;
  value: string;
  note?: string;
  /** True for the basis the review page uses. */
  used?: boolean;
};

export type Definition = {
  id: string;
  title: string;
  kind: DefinitionKind;
  summary: string;
  variants?: DefinitionVariant[];
  bullets?: string[];
  /** What the review page does about it. */
  decision: string;
  /** Open follow-up, if any. */
  followUp?: string;
  /** Where the number comes from. */
  source: string;
};

export const DEFINITIONS: Definition[] = [
  {
    id: "trevpar-bases",
    title: "Two TRevPAR bases",
    kind: "Two bases",
    summary: "Finance and AwayDNA both publish TRevPAR but they do not measure the same revenue, so the two never tie.",
    variants: [
      { label: "Finance", value: "$136.4", note: "September. Includes OTA fees and other revenue.", used: true },
      { label: "AwayDNA", value: "$121.9", note: "September. PMS basis, runs below Finance." },
    ],
    decision: "Finance is the measure for the pillar. The AwayDNA monthly chart is shape only.",
    source: "September Flash Results (Finance); AwayDNA dbt Semantic Layer",
  },
  {
    id: "margin-bases",
    title: "Two margin bases",
    kind: "Two bases",
    summary:
      "Airbnb's host-fee change puts OTA cost gross through the P&L, so reported shop NOI margin falls while the ex-OTA view holds up.",
    variants: [
      { label: "Ex-OTA", value: "+0.8 pt", note: "38.5% vs 37.7% PY, YTD. The 2026 goal (+0.7 pt) was set on this basis.", used: true },
      { label: "Reported (OTA gross)", value: "-1.0 pt", note: "35.2% vs 36.2% PY, YTD. What the board pack shows." },
    ],
    decision: "Pillar status is judged on ex-OTA, with the reported figure always shown beside it.",
    followUp: "The 2026 goal was set ex-OTA; the FY27 target (+0.25 pt, 1 pt stretch) should say which basis it uses.",
    source: "September Flash Results (Finance)",
  },
  {
    id: "churn-views",
    title: "Three churn views",
    kind: "Two bases",
    summary: "Churn is quoted on a base-business TTM view, an enterprise view and the Flash annualized YTD figure. They answer slightly different questions.",
    variants: [
      { label: "Base business, TTM", value: "13.2%", note: "At August." },
      { label: "Enterprise", value: "12.7%", note: "Includes acquired units." },
      { label: "Flash annualized, YTD", value: "12.4%", note: "September month 10.4% annualized.", used: true },
    ],
    decision: "The pillar uses the Flash annualized YTD figure (12.4%). The 2026 goal text says under 12% TTM.",
    followUp: "Agree a single churn definition for the scorecard (see the GBV churn action on SI 007).",
    source: "September Flash Results (Finance); August Results Review",
  },
  {
    id: "organic-adds",
    title: "Organic adds are derived",
    kind: "Derived",
    summary: "Finance reports total gross adds including tuck-ins. Organic adds are the remainder.",
    variants: [
      { label: "Total adds (Finance)", value: "415", note: "September, incl. tuck-ins." },
      { label: "Tuck-in units", value: "142", note: "The three September tuck-ins." },
      { label: "Organic adds (derived)", value: "~270", note: "415 less 142 is 273; shown as ~270.", used: true },
    ],
    decision: "Shown as derived wherever it appears.",
    followUp: "Finance to add an organic line to the Flash.",
    source: "Derived: Finance total minus M&A tuck-in units",
  },
  {
    id: "brand-churn-method",
    title: "Brand churn method",
    kind: "Method",
    summary: "Brand churn lists are built from AwayDNA, not from the Finance pack, so they differ from the ORM scorecard.",
    bullets: [
      "September brand churn rate = AwayDNA September churned units x 12, over current bookable units, rolled up by brand (Meredith Lodging = three shops).",
      "The ORM scorecard uses shop codes and a last-twelve-months window, so the two worst lists will not match one to one.",
      "A brand can look bad on LTM and fine in September (three of the five worst LTM shops churned zero in September).",
    ],
    decision: "Both lists are shown, with the window and source labelled.",
    source: "AwayDNA dbt Semantic Layer; National Financial Review (ORM scorecard)",
  },
  {
    id: "not-measured",
    title: "Not measured monthly yet",
    kind: "Gap",
    summary: "These measures are in the plan but nobody reports them every month, so the review shows n/a.",
    bullets: [
      "September guest review score (the latest is August)",
      "Direct GBV growth (Marketing; FY26 actual not reported)",
      "Properties per FTE (Tech & AI candidate measure)",
      "Any Talent metric",
    ],
    decision: "Shown as \"not reported\" rather than estimated.",
    followUp: "Owners to propose a monthly feed before the November review.",
    source: "MVP gap list",
  },
  {
    id: "ebitda-frame",
    title: "EBITDA frame conflict",
    kind: "Frame",
    summary: "Two documents describe the company EBITDA ambition on different frames.",
    variants: [
      { label: "House view", value: "$150M by 12/31/27", note: "Earlier house target." },
      { label: "SI deck", value: "$180M FY27 budget", note: "BHAG $200M. $300M by 12/31/28.", used: true },
    ],
    decision: "This tool uses the SI deck frame.",
    followUp: "ELT to confirm one frame so every page quotes the same number.",
    source: "260930 Awayday SI Refresh v1; house target as quoted in the MVP notes",
  },
  {
    id: "unit-base",
    title: "Unit base",
    kind: "Reference",
    summary: "Unit counts are quoted on the active and bookable base; other statuses are excluded from churn and TRevPAR denominators.",
    variants: [
      { label: "Active and bookable", value: "15,684", note: "Used for brand churn rates.", used: true },
      { label: "Active, not bookable", value: "392" },
      { label: "Inactive", value: "1,447" },
    ],
    decision: "Brand rates divide by bookable units. AwayDNA, 13 Oct 2026.",
    source: "AwayDNA dbt Semantic Layer, 13 Oct 2026",
  },
];
