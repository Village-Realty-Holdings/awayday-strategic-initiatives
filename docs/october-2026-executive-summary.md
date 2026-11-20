# Executive summary parity — October 2026

_Source of truth: `Awayday October 2026 Strategy Review(2).html`, Summary section
(`#summary`). Everything below is transcribed from that file; nothing is derived
from a calculation._

## The problem

The four executive cards showed the right values (`−$1.2M`, `$79.9M`, `$136.0M`,
`$3.8M`) but the comparison line under them either said **"No comparison
recorded for this month"** or quoted a calculated delta. The reviewed report puts
a business-readable comparison under each card, and colours each half of it
independently:

| Card | Value | Reviewed comparison |
| --- | --- | --- |
| Oct Adj. EBITDA (base business) | −$1.2M | **$1.8M under the $0.6M budget** (red) · **$1.3M under PY** (red) |
| YTD Adj. EBITDA | $79.9M | **+3.6% vs budget** (green) · **+9.0% vs PY** (green) |
| LTM PF Lender EBITDA, Oct-26 | $136.0M | +$0.7M in October (neutral) · $86.4M at Dec-25 (neutral) |
| Oct Shop NOI | $3.8M | **−14.4% vs budget** (red) · **+22.2% vs PY** (green) |

Those comparisons quote budgets and prior-year figures for populations the
application does not hold as observations. Two ways to close the gap:

1. Create synthetic `KpiObservation` rows for the budgets and prior-year values.
   **Rejected.** It would invent financial measurements, break the observation
   contract (reporting scope, publication state, revision, provenance) and
   pollute every table and series that reads them.
2. Store the printed comparison as reviewed presentation data, with its own tone
   and its source document. **Chosen.**

## What was added

**Schema** — `ReviewExecComparison` (`prisma/migrations/20261120120000_review_exec_comparison`):

| Column | Meaning |
| --- | --- |
| `periodId` | The review month (FK to `ReviewPeriod`, cascade on delete) |
| `cardKey` | The headline card id from `review-report.ts` (`month-adjusted-ebitda`, …) |
| `order` | Reading order of the lines under one card |
| `text` | Plain text of one line, exactly as printed |
| `tone` | `POSITIVE` / `WARNING` / `NEGATIVE` / `NEUTRAL`, nullable (null reads neutral) |
| `sourceDocumentName` | The reviewed document the line came from |

Unique on `(periodId, cardKey, order)`. Plain text only — no HTML, no markup, no
executable content. The table stores presentation, so a future month can carry
different lines, or none at all.

**Shaping** — `applyReviewedComparisons()` in `review-report.ts` attaches the
month's lines to the cards they belong to, keeping the reviewer's order and
ignoring (never re-homing) a line whose card is absent. `buildExecCards()` sets
`reviewed: null`, so a month without rows behaves exactly as before.

**Presentation** — `ExecSummary` renders the reviewed lines, each coloured by its
stored tone, joined with the report's interpunct. The technical "Required to
compare: …" sentence is gone from the executive page. When a month has no
reviewed statement, the page falls back to a calculated comparison if one exists,
and otherwise says **"No comparison recorded for this month."**

**Summary so-whats** — the four reviewed bullets now sit directly beneath the
cards, in the order and colours of the report:

| # | Lead (bold) | Tone |
| --- | --- | --- |
| 1 | Shop NOI missed budget and Adj. EBITDA went negative. | NEGATIVE |
| 2 | M&A stays well ahead of goal. | POSITIVE |
| 3 | Churn beat budget for a second month running, still behind on the year. | POSITIVE |
| 4 | Cash CAC is over budget for a fourth month. | NEGATIVE |

Bullet 3 is green in the report even though it names a year-to-date shortfall;
that mixed judgement is the reviewer's and is preserved rather than re-derived.

**Admin** — `/admin/review-data-quality` (admin only) shows, per card: the value,
the comparison state, whether a reviewed comparison is recorded, the source
document, and **the exact observation identities that are missing**. That is where
the technical detail lives now.

## Production write

`prisma/configure-october-2026-exec-summary.ts` writes the October rows.

- Dry run by default; `--apply` writes; `--snapshot` records the before-state;
  `--revert` puts it back.
- Only `ReviewExecComparison` rows for `2026-10` and that month's `SUMMARY`
  so-whats are written. No observation, target, mapping, pillar status or other
  month is touched.
- The single summary record production already held
  (`user-review-sowhat-202610-summary`) **keeps its id**: its AI-drafted text is
  replaced with the report's first bullet, and three further bullets are added
  with deterministic ids. Nothing is deleted.
- Any line or bullet holding content this correction does not expect is reported
  as drift and the write is refused, so a newer approved edit is never
  overwritten. Every write is one serializable transaction with an audit row.

## Verification

- Constants are compared against the reviewed HTML's Summary section, including
  the Unicode minus sign (−), the interpunct (·) and the exact figures.
- Regression tests cover: the four cards and their lines; exact wording and tones;
  mixed lines staying mixed; a month with no rows; re-running as a no-op; drift
  refusal; the four bullets' order, text, tones and ids; replacing the single
  stored summary without deleting it; and an unexpected fifth row being reported.
- `tsc --noEmit`, `eslint`, `vitest`, `next build` and `prisma validate` pass.
