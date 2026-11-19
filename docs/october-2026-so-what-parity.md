# October 2026 So-What tone parity

_Recorded 2026-11-19. Item-level comparison of the seven production `ReviewSoWhat`
records against the reviewed October report, plus the structural proposal the
brief requires before production content is replaced._

## Reference structure

`Awayday October 2026 Strategy Review(2).html` carries **33 independently coloured
so-what bullets across 8 sections** (the seven pillar/summary sections plus the
Base Business bridge). Production holds **7 records**, one per section, each a
single summary sentence pair.

Reference tone mix: POSITIVE 10 / NEGATIVE 17 / WARNING 6 (the report has no
neutral bullet; neutral is used here only where a stored item states a fact with
no direction).

## Item-level comparison (the seven production records)

All seven held `tone = NULL` before this pass. Record identity is preserved; no
row was deleted or inserted. Written with `prisma/configure-october-2026-so-what-tones.ts`
(dry run by default, `--apply`, audit row per record, drift guard on the exact
headline and body).

| # | Record ID | Scope | Headline | Reference bullets (tones) | Stored tone before | Stored tone now | Required action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `user-review-sowhat-202610-summary` | SUMMARY | October performance: growth ahead, mixed operating results | 4 — down / up / up / down | `NULL` | **WARNING** | tone stored; wording unchanged |
| 2 | `user-review-sowhat-202610-m-a` | M&A | Acquired EBITDA ahead of the 2026 goal | 4 — up / up / flag / flag | `NULL` | **POSITIVE** | tone stored |
| 3 | `user-review-sowhat-202610-grow` | GROW | Unit additions are ahead; CAC remains above budget | 4 — up / down / up / down | `NULL` | **WARNING** | tone stored |
| 4 | `user-review-sowhat-202610-retention` | RETENTION | Churn remains above the annual target | 4 — up / down / down / flag | `NULL` | **NEGATIVE** | tone stored |
| 5 | `user-review-sowhat-202610-trevpar` | TREVPAR | YTD TRevPAR growth remains positive, October softened | 4 — down / flag / up / down | `NULL` | **WARNING** | tone stored |
| 6 | `user-review-sowhat-202610-margin` | MARGIN | Ex-OTA Shop NOI margin ahead year to date | 4 — up / down / down / down | `NULL` | **WARNING** | tone stored |
| 7 | `user-review-sowhat-202610-guest` | GUEST | Guest review average meets YTD benchmark, six brands below floor | 5 — down / down / up / flag / flag | `NULL` | **WARNING** | tone stored |

Rules applied, item by item:

- **M&A is the only POSITIVE.** Both of its result bullets are up, and the two
  watch bullets (cycle time, deals in play) are not stated in the stored summary,
  so the stored wording is unambiguously good news.
- **A mixed statement that contains a material negative is WARNING, never
  POSITIVE.** Grow (volume up, cost per add over budget), TRevPAR (YTD up, October
  down on both bases) and Margin (ex-OTA up, reported down 1.0 pt) all fail this
  test and are WARNING.
- **Retention is NEGATIVE.** Its headline is the year-to-date miss against the
  annual target; the October beat against a monthly budget is supporting detail,
  not the subject. The reference's own churn section leads with the October beat,
  which is exactly why the stored summary must not take the section's colour.
- **Summary is WARNING.** Two good-news bullets and two misses.
- **Guest is WARNING.** Benchmark met *and* six brands below the floor in the same
  breath.

## Result in the UI

`ReviewSoWhat.tone` is now the authoritative colour for those seven items, so the
pillar-RAG fallback no longer paints a mixed item green. Verified against the
merged commit and the production database: the seven October blocks render
neutral / POSITIVE / WARNING / NEGATIVE / WARNING / WARNING / WARNING.

## Structural proposal — NOT applied

The remaining gap is structural, not tonal: production has 7 summary records, the
report has 33 bullets.

Proposal, for Justin's approval before any production content changes:

1. Keep the seven existing records exactly as they are (identity, scope, order,
   wording, tone) as the section summaries.
2. Add 26 records so each section carries the reference's own bullets, with
   `order` running within the section and `scope` unchanged. Per section:
   summary 4, M&A 4, grow 4, retention 4, TRevPAR 4, margin 4, guest 5, bridge 4
   (the bridge currently has no record at all in production).
3. Each new record carries Alex's original bullet text and the tone the report
   gives that bullet — several sections contain their own mixed bullets, which is
   exactly why they must stay separate rather than collapse into one colour.
4. No Claude-generated commentary. The text is the reviewed report's text.

Why it is not applied here: it changes record count and identity, adds a section
that does not exist in production, and rewrites what a reader sees under "So
what" for the October review. The brief requires that to be proposed explicitly
first. It is decision **D1** in `docs/october-2026-parity-corrections.md`.

Reversible: the tone pass wrote only `ReviewSoWhat.tone` on seven known record
IDs; revert with
`npx tsx prisma/configure-october-2026-so-what-tones.ts --revert --snapshot <file>`.
