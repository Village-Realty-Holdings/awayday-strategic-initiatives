/**
 * October 2026 executive-summary presentation, transcribed from the reviewed
 * report (`Awayday October 2026 Strategy Review(2).html`).
 *
 * Why this is presentation data and not observations: the report compares the
 * four headline figures with budgets and prior-year values for populations the
 * application does not hold. Fabricating a `KpiObservation` to stand behind
 * "$1.8M under the $0.6M budget" would put an invented measurement into the
 * financial record; storing the printed comparison, with its own tone and its
 * source document, reproduces the report without touching a measurement.
 *
 * Every string below is copied from the reviewed HTML, including the Unicode
 * minus sign the report uses (−) and the interpunct it separates lines with (·).
 *
 * Tone vocabulary, as stored: POSITIVE / WARNING / NEGATIVE / NEUTRAL. The
 * reference's `up` / `down` spans map to POSITIVE / NEGATIVE; a line with no
 * colour in the report (the LTM card's two lines) maps to NEUTRAL.
 */

export type StoredTone = "POSITIVE" | "WARNING" | "NEGATIVE" | "NEUTRAL";

/** The reviewed document these statements come from, stored with each row. */
export const OCTOBER_2026_EXEC_SOURCE = "Awayday October 2026 Strategy Review(2).html";

export type ExecComparisonLine = { text: string; tone: StoredTone };

export type ExecComparisonCard = {
  /** ExecCard id from src/lib/review-report.ts. */
  cardKey: string;
  /** The card title, for the dry-run report only. */
  card: string;
  lines: readonly ExecComparisonLine[];
};

/** The four tiles, exactly as the reviewed report prints them. */
export const OCTOBER_2026_EXEC_COMPARISONS: readonly ExecComparisonCard[] = [
  {
    cardKey: "month-adjusted-ebitda",
    card: "Oct Adj. EBITDA (base business)",
    lines: [
      { text: "$1.8M under the $0.6M budget", tone: "NEGATIVE" },
      { text: "$1.3M under PY", tone: "NEGATIVE" },
    ],
  },
  {
    cardKey: "ytd-adjusted-ebitda",
    card: "YTD Adj. EBITDA",
    lines: [
      { text: "+3.6% vs budget", tone: "POSITIVE" },
      { text: "+9.0% vs PY", tone: "POSITIVE" },
    ],
  },
  {
    cardKey: "ltm-lender-ebitda",
    card: "LTM PF Lender EBITDA",
    lines: [
      { text: "+$0.7M in October", tone: "NEUTRAL" },
      { text: "$86.4M at Dec-25", tone: "NEUTRAL" },
    ],
  },
  {
    cardKey: "month-shop-noi",
    card: "Oct Shop NOI",
    lines: [
      { text: "−14.4% vs budget", tone: "NEGATIVE" },
      { text: "+22.2% vs PY", tone: "POSITIVE" },
    ],
  },
];

/** One stored comparison line, as the correction reads it. */
export type StoredExecComparison = {
  id: string;
  cardKey: string;
  order: number;
  text: string;
  tone: string | null;
  sourceDocumentName: string | null;
};

export type ExecComparisonCreate = { cardKey: string; order: number; text: string; tone: StoredTone; sourceDocumentName: string };

export type ExecComparisonPlan = {
  /** Lines the month does not hold yet, in card and reading order. */
  toCreate: ExecComparisonCreate[];
  /** Lines already stored exactly as the review prints them. */
  alreadyApplied: number;
  /**
   * Lines stored with different wording or tone. Never overwritten: a changed
   * line may be a newer approved edit, so it is reported and the write refused.
   */
  drift: { cardKey: string; order: number; found: StoredExecComparison }[];
};

/**
 * Lines the October 2026 report printed that the month does not hold yet.
 * Matching is by (cardKey, order), so re-running is a no-op and a hand-edited
 * line is reported as drift rather than replaced.
 */
export function planExecComparisons(current: readonly StoredExecComparison[]): ExecComparisonPlan {
  const byKey = new Map(current.map((row) => [`${row.cardKey}\u0000${row.order}`, row]));
  const plan: ExecComparisonPlan = { toCreate: [], alreadyApplied: 0, drift: [] };
  const expected = new Set<string>();

  for (const card of OCTOBER_2026_EXEC_COMPARISONS) {
    card.lines.forEach((line, order) => {
      const key = `${card.cardKey}\u0000${order}`;
      expected.add(key);
      const found = byKey.get(key);
      if (!found) {
        plan.toCreate.push({ cardKey: card.cardKey, order, text: line.text, tone: line.tone, sourceDocumentName: OCTOBER_2026_EXEC_SOURCE });
        return;
      }
      if (found.text === line.text && found.tone === line.tone) plan.alreadyApplied += 1;
      else plan.drift.push({ cardKey: card.cardKey, order, found });
    });
  }

  // A line this correction does not know about is left exactly as it is, but it
  // is reported so nobody assumes the month holds only the reviewed lines.
  for (const row of current) {
    const key = `${row.cardKey}\u0000${row.order}`;
    if (!expected.has(key)) plan.drift.push({ cardKey: row.cardKey, order: row.order, found: row });
  }
  return plan;
}

/** One reviewed summary so-what, exactly as the report prints it. */
export type SummarySoWhatSeed = {
  /** The record id to write. The first keeps the existing summary record's id. */
  id: string;
  order: number;
  headline: string;
  body: string;
  tone: StoredTone;
};

/**
 * The four "So what" bullets under the headline cards ("Four things to take from
 * October"). Bullet 1 keeps the id of the single summary record production
 * already holds, so its identity and history survive the replacement; bullets 2-4
 * are added with deterministic ids. Nothing is deleted.
 */
export const OCTOBER_2026_SUMMARY_SO_WHATS: readonly SummarySoWhatSeed[] = [
  {
    id: "user-review-sowhat-202610-summary",
    order: 0,
    headline: "Shop NOI missed budget and Adj. EBITDA went negative.",
    body: "Shop NOI was $0.6M under budget, $0.5M of it the hurricane in NE and NW Florida. Support ran $0.5M over and BD $0.7M over, so Adj. EBITDA was −$1.2M against a +$0.6M budget. YTD is still $2.7M ahead.",
    tone: "NEGATIVE",
  },
  {
    id: "user-review-sowhat-202610-summary-2",
    order: 1,
    headline: "M&A stays well ahead of goal.",
    body: "21 deals and $34.8M of acquired EBITDA closed, against a $23M goal. One close in October (CooperWynn, $0.3M); five LOIs signed in the month, taking the LOI book to 10 deals and $8.8M.",
    tone: "POSITIVE",
  },
  {
    id: "user-review-sowhat-202610-summary-3",
    order: 2,
    headline: "Churn beat budget for a second month running, still behind on the year.",
    body: "12.2% annualized in October vs an 18.4% budget (149 units vs 211). YTD is 12.4% vs 11.5% budget; LTM holds at 13.0%.",
    tone: "POSITIVE",
  },
  {
    id: "user-review-sowhat-202610-summary-4",
    order: 3,
    headline: "Cash CAC is over budget for a fourth month.",
    body: "$7,306 in October, 45% over the $5,046 budget, driven by new owner guarantees and accelerator bonuses. Organic adds were 260, 4 under budget.",
    tone: "NEGATIVE",
  },
];

/** The single summary record the October review held before this correction. */
export const OCTOBER_2026_SUPERSEDED_SUMMARY = {
  id: "user-review-sowhat-202610-summary",
  order: 0,
  headline: "October performance: growth ahead, mixed operating results",
  body: "Acquired EBITDA closed reached $34.8M YTD versus a $23M 2026 goal; BD unit additions reached 3,340 YTD. Annualized unit churn was 12.4% YTD, and October TRevPAR growth was -0.9% versus prior year despite +4.1% YTD.",
  tone: "WARNING",
} as const;

export type StoredSummary = {
  id: string;
  order: number;
  headline: string;
  body: string | null;
  tone: string | null;
};

export type SummaryPlan = {
  /** Existing rows whose wording must change to the reviewed bullet. */
  toUpdate: { before: StoredSummary; after: SummarySoWhatSeed }[];
  /** Bullets the month does not hold yet. */
  toCreate: SummarySoWhatSeed[];
  alreadyApplied: number;
  /** Rows that differ from both the expected bullet and the superseded text. */
  drift: StoredSummary[];
};

/**
 * Plan the replacement of the month's summary so-whats with the report's four
 * bullets. The write is refused when a row holds anything other than what this
 * correction expects (the superseded AI-drafted summary, or the reviewed bullet
 * already in place), because that difference may be a newer approved edit.
 */
export function planSummarySoWhats(current: readonly StoredSummary[]): SummaryPlan {
  const plan: SummaryPlan = { toUpdate: [], toCreate: [], alreadyApplied: 0, drift: [] };
  const byId = new Map(current.map((row) => [row.id, row]));

  for (const seed of OCTOBER_2026_SUMMARY_SO_WHATS) {
    const found = byId.get(seed.id);
    if (!found) {
      plan.toCreate.push(seed);
      continue;
    }
    if (found.headline === seed.headline && (found.body ?? "") === seed.body && found.tone === seed.tone && found.order === seed.order) {
      plan.alreadyApplied += 1;
      continue;
    }
    const isSuperseded =
      seed.id === OCTOBER_2026_SUPERSEDED_SUMMARY.id &&
      found.headline === OCTOBER_2026_SUPERSEDED_SUMMARY.headline &&
      (found.body ?? "") === OCTOBER_2026_SUPERSEDED_SUMMARY.body &&
      found.tone === OCTOBER_2026_SUPERSEDED_SUMMARY.tone;
    if (isSuperseded) plan.toUpdate.push({ before: found, after: seed });
    else plan.drift.push(found);
  }

  // Any other summary row is left untouched, but reported: the executive page
  // would otherwise show five bullets while the report has four.
  const expectedIds = new Set(OCTOBER_2026_SUMMARY_SO_WHATS.map((seed) => seed.id));
  for (const row of current) if (!expectedIds.has(row.id)) plan.drift.push(row);
  return plan;
}
