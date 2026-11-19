/**
 * October 2026 So-What tone correction.
 *
 * The reviewed October report colours each so-what item individually. Production
 * holds seven so-what records for October, one per section, and every one has
 * `tone = NULL`, so each item inherits its section's status colour. That fallback
 * cannot express a mixed item: the Grow item says unit adds are ahead *and* CAC
 * is over budget, and the section's green would paint the whole statement as good
 * news.
 *
 * This correction stores a semantic tone on each existing record. It does not
 * touch the wording, the scope, the order or the record identity, and it never
 * deletes or inserts a row.
 *
 * What it deliberately does NOT do: replace the seven summaries with the reviewed
 * report's 33 independent bullets. That is a structural change (7 records → 33,
 * across eight sections, with different scopes and several differently-coloured
 * bullets per section). Section 12 of the brief requires that change to be
 * proposed before production content is modified, so the comparison and proposal
 * live in `describeStructuralGap()` and in docs rather than being applied here.
 *
 * Tone vocabulary, as stored: POSITIVE / WARNING / NEGATIVE / NEUTRAL.
 * A mixed statement that contains a material negative result is WARNING — never
 * POSITIVE — which is the rule the reviewed report applies to its own mixed items.
 */

export type StoredTone = "POSITIVE" | "WARNING" | "NEGATIVE" | "NEUTRAL";

export type ReferenceSection = {
  /** The reviewed report's section this record summarises. */
  card: string;
  /** How many independent bullets that section carries. */
  bullets: number;
  /** The tones those bullets carry, in order ("up" | "down" | "flag"). */
  bulletTones: readonly ("up" | "down" | "flag")[];
  /** Why the stored summary cannot reproduce them as a single colour. */
  note: string;
};

export type SoWhatToneCorrection = {
  /** The existing production record id. Preserved, never recreated. */
  id: string;
  scope: string;
  /** The exact headline this correction expects to find, as a drift guard. */
  headline: string;
  /** The exact body this correction expects to find, as a drift guard. */
  body: string;
  /** The tone the record holds today. Only `null` is corrected. */
  from: null;
  /** The semantic tone to store. */
  to: StoredTone;
  reference: ReferenceSection;
  reason: string;
};

export const OCTOBER_SO_WHAT_TONE_CORRECTIONS: readonly SoWhatToneCorrection[] = [
  {
    id: "user-review-sowhat-202610-summary",
    scope: "SUMMARY",
    headline: "October performance: growth ahead, mixed operating results",
    body:
      "Acquired EBITDA closed reached $34.8M YTD versus a $23M 2026 goal; BD unit additions reached 3,340 YTD. Annualized unit churn was 12.4% YTD, and October TRevPAR growth was -0.9% versus prior year despite +4.1% YTD.",
    from: null,
    to: "WARNING",
    reference: {
      card: "So what (summary)",
      bullets: 4,
      bulletTones: ["down", "up", "up", "down"],
      note:
        "The summary section is two good-news bullets and two misses. A summary that names a negative alongside the positives is a watch item, never plain good news.",
    },
    reason: "Mixed result: growth ahead, churn above target and October TRevPAR under prior year.",
  },
  {
    id: "user-review-sowhat-202610-m-a",
    scope: "M&A",
    headline: "Acquired EBITDA ahead of the 2026 goal",
    body:
      "Acquired EBITDA closed totaled $34.8M YTD against the $23M goal. October contributed $0.3M; 21 deals and 4,822 units were acquired YTD.",
    from: null,
    to: "POSITIVE",
    reference: {
      card: "So what (M&A)",
      bullets: 4,
      bulletTones: ["up", "up", "flag", "flag"],
      note:
        "Both result bullets are up. The two watch bullets concern cycle time and deals still in play, which this summary does not state, so the stored item is unambiguously good news.",
    },
    reason: "Unambiguously ahead of the 2026 goal on both deals and acquired EBITDA.",
  },
  {
    id: "user-review-sowhat-202610-grow",
    scope: "GROW",
    headline: "Unit additions are ahead; CAC remains above budget",
    body: "BD unit adds totaled 3,340 YTD against 2,608 budget. October added 330. Cash CAC was $7,306 in October versus $5,046 budget.",
    from: null,
    to: "WARNING",
    reference: {
      card: "So what (unit growth)",
      bullets: 4,
      bulletTones: ["up", "down", "up", "down"],
      note:
        "The reviewed section splits volume (up) from cost per add (down). The stored item states both in one sentence, so it is a mixed statement with a material negative and must not be green.",
    },
    reason: "Mixed: volume ahead, cost per add over budget.",
  },
  {
    id: "user-review-sowhat-202610-retention",
    scope: "RETENTION",
    headline: "Churn remains above the annual target",
    body:
      "Annualized unit churn was 12.4% YTD versus an 11.5% YTD budget. October churn was 12.2%, below the 18.4% monthly budget; TTM churn in the Ares pack was 13.0%.",
    from: null,
    to: "NEGATIVE",
    reference: {
      card: "So what (churn)",
      bullets: 4,
      bulletTones: ["up", "down", "down", "flag"],
      note:
        "The reviewed section leads with the October beat, but the stored headline is the year-to-date miss against the annual target. The headline is what the item is about, and it is a miss.",
    },
    reason: "Headline is the annual target miss, which is the year's material negative; the October beat is supporting detail.",
  },
  {
    id: "user-review-sowhat-202610-trevpar",
    scope: "TREVPAR",
    headline: "YTD TRevPAR growth remains positive, October softened",
    body:
      "Reported TRevPAR growth versus prior year was +4.1% YTD, while October was -0.9%. On an ex-OTA basis, growth was +0.6% YTD and -3.9% in October.",
    from: null,
    to: "WARNING",
    reference: {
      card: "So what (TRevPAR)",
      bullets: 4,
      bulletTones: ["down", "flag", "up", "down"],
      note:
        "The reviewed section is mostly caution: October under budget and prior year, growth carried by fees rather than rate, and market trailing. The stored item keeps the positive YTD and the negative month together.",
    },
    reason: "Mixed: positive YTD, but October is under prior year on both bases.",
  },
  {
    id: "user-review-sowhat-202610-margin",
    scope: "MARGIN",
    headline: "Ex-OTA Shop NOI margin ahead year to date",
    body:
      "Ex-OTA Shop NOI margin improved 0.8 percentage points YTD versus prior year and 0.5 points in October. Reported margin change was -1.0 point YTD and -0.4 point in October.",
    from: null,
    to: "WARNING",
    reference: {
      card: "So what (margin)",
      bullets: 4,
      bulletTones: ["up", "down", "down", "down"],
      note:
        "One up bullet and three down. The stored item pairs the ex-OTA gain with the reported-basis loss, which is exactly the mixed reading the section carries.",
    },
    reason: "Mixed: ex-OTA ahead, reported basis behind by 1.0 pt.",
  },
  {
    id: "user-review-sowhat-202610-guest",
    scope: "GUEST",
    headline: "Guest review average meets YTD benchmark, six brands below floor",
    body: "Average review score was 4.65 YTD and 4.64 in October. Six brands were below the 4.5 TTM review-score floor.",
    from: null,
    to: "WARNING",
    reference: {
      card: "So what (guest experience)",
      bullets: 5,
      bulletTones: ["down", "down", "up", "flag", "flag"],
      note:
        "The reviewed section is led by the October slip and the brands under the floor, with one up bullet. The stored item states the benchmark is met and the floor is breached in the same breath.",
    },
    reason: "Mixed: benchmark met, but six brands are below the review-score floor.",
  },
];

export type ToneCorrectionPlan = {
  changes: SoWhatToneCorrection[];
  drift: { correction: SoWhatToneCorrection; state: "missing" | "already-applied" | "unexpected"; found: { headline: string; body: string | null; tone: string | null } | null }[];
};

/**
 * What the correction would write, refused where the record has moved. A record
 * whose headline, body or tone differs from what this correction expects is
 * reported as drift and never overwritten — a newer approved edit always wins.
 */
export function planSoWhatToneCorrections(
  rows: readonly { id: string; headline: string; body: string | null; tone: string | null }[],
): ToneCorrectionPlan {
  const changes: SoWhatToneCorrection[] = [];
  const drift: ToneCorrectionPlan["drift"] = [];
  for (const correction of OCTOBER_SO_WHAT_TONE_CORRECTIONS) {
    const row = rows.find((candidate) => candidate.id === correction.id);
    if (!row) {
      drift.push({ correction, state: "missing", found: null });
      continue;
    }
    if (row.tone === correction.to) {
      drift.push({ correction, state: "already-applied", found: { headline: row.headline, body: row.body, tone: row.tone } });
      continue;
    }
    if (row.headline !== correction.headline || (row.body ?? "") !== correction.body || row.tone !== null) {
      drift.push({ correction, state: "unexpected", found: { headline: row.headline, body: row.body, tone: row.tone } });
      continue;
    }
    changes.push(correction);
  }
  return { changes, drift };
}

/** One readable line per change, for a dry run a person can approve. */
export function describeToneCorrection(correction: SoWhatToneCorrection): string {
  return [
    `${correction.scope} · ${correction.id}`,
    `  headline: ${correction.headline}`,
    `  tone:     NULL → ${correction.to}`,
    `  why:      ${correction.reason}`,
  ].join("\n");
}

/**
 * The difference between the reviewed report's commentary and what production
 * stores, stated precisely and not applied. This is the proposal section 12 asks
 * for: the reference has 33 independently coloured bullets across eight sections;
 * production has seven section summaries. Reproducing the report needs a
 * replacement, not a recolouring, and that needs Justin's approval first.
 */
export function describeStructuralGap(): { productionItems: number; referenceItems: number; sections: number; note: string } {
  return {
    productionItems: OCTOBER_SO_WHAT_TONE_CORRECTIONS.length,
    referenceItems: 33,
    sections: 8,
    note:
      "Production holds one summary per section. The reviewed report holds 4–5 independently coloured bullets per section, and several of them are themselves mixed. " +
      "A single stored item cannot carry two colours, and collapsing several bullets into one item would lose the red/green separation the report relies on. " +
      "Replacing the seven records with the reviewed bullets is therefore proposed, not applied: it changes record identity and count, and the brief requires explicit approval for a structural change. " +
      "Until then each stored summary carries the semantic tone of its own wording, and no item is coloured green while it also reports a material negative.",
  };
}
