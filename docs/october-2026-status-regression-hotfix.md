# October 2026 status regression — root cause and hotfix

_2026-11-19. Production showed no red/green/yellow October pillar indicators after
PR #25 and PR #26 were merged and deployed, although the reviewed October report
shows green, amber and red statuses and the earlier deployment did show colours._

## Answer: why the previous dashboard showed colours and the current one does not

**It is a code regression that exposed a configuration absence — not one thing
failing everywhere.** PR #26 replaced a permissive status calculation with a
stricter one. The old calculation could produce a colour from two things
production already had; the new one requires a third thing production did not
have (an explicit 2026 goal for each pillar's primary measure) and an explicit
approval for anything else. Each pillar therefore fell to the neutral
`Not configured` state, each for a slightly different reason.

Cause by cause, against the six possibilities:

| # | Possible cause | Finding |
| --- | --- | --- |
| A | The application selects a different review period | **Not a cause.** `resolvePeriod` picks the newest PUBLISHED month, else the newest period; 2026-10 is newest, so October loads. |
| B | An approved manual status is no longer used | **Part of the cause, by absence.** October had **zero** `ReviewPillarStatus` rows — only September had four. Nothing was being ignored; there was nothing to use, and September's are (correctly) period-scoped to 2026-09. |
| C | The primary-measure selector requires missing configuration | **Contributing cause.** `selectPrimaryMeasure` now requires exactly one **active** `KpiMeasureMapping`. The four reviewed October definitions existed with `strategicAreaId = NULL` and no mapping, so each pillar fell back to its FY27 plan definition. |
| D | Direction/goal validation rejects the previously displayed statuses | **Direct cause of the neutral badges.** `mappingRag` now needs a stated goal in the measure's own quantity plus a declared direction and time basis; the FY27 definitions carry FY27 planning targets only, and an FY27 target is deliberately never substituted. Result: `no-goal` / `goal-not-comparable` for all five pillars. |
| E | So-What tone values were never populated | **True for the seven October So-Whats** (all `tone = NULL`), and worse, the renderer's fallback derived the tone from the now-grey measure, so the commentary lost its colour too. |
| F | CSS or the status component renders valid statuses without colour | **Ruled out.** The badge variants, the `ok`/`warn`/`risk` tokens and their dark-mode overrides are present; passing a tone renders colour. |

How the old dashboard got colours at `8dfcce3`: the primary measure was
`a.kpis[0]` and the target was the mapping's FY27 figure, so M&A $34.8M vs $26M,
Grow 3,340 vs 23, Retention 12.4% vs 11% (lower is better), TRevPAR +4.1% vs 1
and Margin +0.8 vs 0.25 all produced a coloured status — roughly right by
coincidence, and in three cases by comparing figures of different meaning.

## A second, independent defect found and fixed

After the reviewed configuration was applied, the house cards showed **October
monthly** figures beside **year-to-date** statuses (Grow 330, Retention 12.2%,
TRevPAR −0.9%, Margin +0.5 pt) while the reviewed report states 3,340, 12.4%,
+4.1% and +0.8 pt. Cause: `currentKpiValue` is `selectCurrentObservations()[0]`
and that selector's presentation order puts `MONTHLY` first
(`TIME_BASIS_PRECEDENCE = ["MONTHLY", "YTD", "POINT_IN_TIME", "LTM"]`). Production
publishes **both** bases for each reviewed metric, so the month's row won.

Fixed by `measureValue(rows, period, timeBasis)` in `src/lib/review-kpi.ts`: the
mapping's own declared basis decides which observation is shown, and only a
basis the metric does not publish at all falls back (YTD first, then any actual).
A YTD mapping can no longer display the month's figure beside a year-to-date
status.

## What was restored

1. **Approved business statuses** (`prisma/configure-october-2026-statuses.ts`,
   `--apply`). The five statements the reviewed October page shows, written to
   2026-10 only, through a script with a dry-run default, a version-2
   before/after snapshot, a Serializable transaction, per-row `AuditLog`
   CREATE/UPDATE, a refusal to write into a published period, and a refusal to
   overwrite a row that changed while the plan was being applied:

   | Pillar | Stored status | Colour |
   | --- | --- | --- |
   | M&A | `Ahead` | green |
   | Grow New Units | `Ahead · CAC off track` | green |
   | Owner Retention | `Behind · October beat budget` | red |
   | TRevPAR Expansion | `On track reported · October under PY` | amber |
   | Margin Expansion | `On goal ex-OTA · behind reported` | amber |

   `ReviewPillarStatus.status` is a `String`, and `parseApprovedPillarStatus`
   reads the status word and keeps the reviewer's wording, so a combined
   statement needed **no schema change and no migration**. The badge shows the
   full wording; the status word sets the colour.

2. **Reviewed 2026 primary measures** (`prisma/configure-october-2026-primary-measures.ts`,
   `--apply`, 16 changes, 0 issues, 1 note): `FY27:M&A` kept as the primary with
   its 2026 goal `$23M`; `user_review:bd_unit_adds`,
   `user_review:annualized_unit_churn`, `user_review:trevpar_growth_reported` and
   `user_review:shop_noi_margin_delta_py_ex_ota` linked to their pillars and
   mapped `DIRECT`, `YTD`, with the reviewed direction and display format; the
   four superseded FY27 mappings deactivated but kept as supporting measures;
   2026 goal wording set on Retention, TRevPAR and Margin. No `KpiObservation`
   was read for writing, no `targetBudget`/`targetStretch` was touched.

3. **Presentation** so a stored status is shown as approved and an amber pillar
   is amber: `MeasureStatus` maps the pillar RAG to a badge tone
   (`PILLAR_TONE`), renders the approved wording in full, and
   `statusToneWithRule` lets `on_track` honour an amber rule. So-What blocks
   derive their fallback tone from the pillar **RAG** (`toneForRag`) rather than
   from the status word, because `on_track` alone maps to green.

## So-What tones — prepared, awaiting approval (no write performed)

All seven October rows still have `tone = NULL`. Their rendered colour today
comes from the pillar RAG fallback, which is why the section colours now match
the reviewed page. The table below compares each stored row with the reviewed
page. **No row has been written**: the seven bodies are condensed paraphrases of
several reviewed bullets each, so the tone is a judgement, and a judgement that
changes a colour is a business decision.

| Existing ID | Scope | Headline | Body | Original reference tone | Proposed tone | Action required |
| --- | --- | --- | --- | --- | --- | --- |
| `user-review-sowhat-202610-summary` | SUMMARY | October performance: growth ahead, mixed operating results | Acquired EBITDA closed reached $34.8M YTD versus a $23M 2026 goal; BD unit additions reached 3,340 YTD. Annualized unit churn was 12.4% YTD, and October TRevPAR growth was -0.9% versus prior year despite +4.1% YTD. | Mixed: 2 up, 2 down in the Summary block | `NEUTRAL` (keeps today's colour) | Confirm "mixed" verdict; then store |
| `user-review-sowhat-202610-m-a` | M&A | Acquired EBITDA ahead of the 2026 goal | Acquired EBITDA closed totaled $34.8M YTD against the $23M goal. October contributed $0.3M; 21 deals and 4,822 units were acquired YTD. | `up`, `up` + two `flag` | `POSITIVE` (keeps today's colour) | Confirm; then store |
| `user-review-sowhat-202610-grow` | GROW | Unit additions are ahead; CAC remains above budget | BD unit adds totaled 3,340 YTD against 2,608 budget. October added 330. Cash CAC was $7,306 in October versus $5,046 budget. | `up`,`down`,`up`,`down`; chips good *Ahead on adds* + crit *CAC off track* | **Decision needed:** `POSITIVE` (matches the green pillar chip) or `WARNING` (matches the named CAC miss; today's fallback is `positive`) | Justin to choose; then store |
| `user-review-sowhat-202610-retention` | RETENTION | Churn remains above the annual target | Annualized unit churn was 12.4% YTD versus an 11.5% YTD budget. October churn was 12.2%, below the 18.4% monthly budget; TTM churn in the Ares pack was 13.0%. | `up`, `down`, `down`, `flag`; chip crit *Behind on the year* | `NEGATIVE` (keeps today's colour) | Confirm; then store |
| `user-review-sowhat-202610-trevpar` | TREVPAR | YTD TRevPAR growth remains positive, October softened | Reported TRevPAR growth versus prior year was +4.1% YTD, while October was -0.9%. On an ex-OTA basis, growth was +0.6% YTD and -3.9% in October. | `down`, `flag`, `up`, `down`; chip warn | `WARNING` (keeps today's colour) | Confirm; then store |
| `user-review-sowhat-202610-margin` | MARGIN | Ex-OTA Shop NOI margin ahead year to date | Ex-OTA Shop NOI margin improved 0.8 percentage points YTD versus prior year and 0.5 points in October. Reported margin change was -1.0 point YTD and -0.4 point in October. | `up`, `down`, `down`, `down`; chip warn *On goal ex-OTA · behind on reported basis* | `WARNING` (keeps today's colour) | Confirm; then store |
| `user-review-sowhat-202610-guest` | GUEST | Guest review average meets YTD benchmark, six brands below floor | Average review score was 4.65 YTD and 4.64 in October. Six brands were below the 4.5 TTM review-score floor. | `down`, `down`, `up`, `flag`, `flag`; chip warn *Just under standard, floor breached* | **Decision needed:** `WARNING` (matches the reviewed chip; today's fallback is `neutral` because Guest Experience is an enabler with no measure) | Justin to choose; then store |

For the five rows whose proposed tone matches what the pillar RAG fallback
already renders, storing the tone changes no colour — it makes the approved
judgement explicit and survives a future change to the pillar status.

### Missing commentary, prepared separately (not inserted)

The reviewed page carries 44 classed So-What bullets across eight sections; the
seven stored rows condense them. The four **October financials (bridge)** items
are not stored at all (P&L/bridge, OTA and maintenance margins, support and BD
spend, regions vs budget). Adding them is new content from Alex's commentary and
needs an explicit instruction, an approved scope and the audited editor path —
none of it is done here.

## Remaining differences from the reviewed page

1. **Guest Experience has no status.** It is an `ENABLER` in production and
   `setPillarMeasure`/`planOctoberPillarStatuses` refuse an approved status on an
   enabler ("Only pillars can have a status set by hand"). The reviewed page
   shows amber *Just under standard, floor breached*. Showing it needs a
   decision plus a small rule change.
2. **Grow has no calculated status.** 3,340 unit adds cannot be judged against
   the 22% FY27 target, and no count-based 2026 goal exists. The approved
   `Ahead · CAC off track` status carries it instead; a count goal from the Grow
   owner/FP&A would let the calculation stand on its own.
3. **The seven So-What tones** are prepared above and unapplied.
4. **September shows no values for the four reviewed metrics** because those
   metrics only have 2026-10 observations. Not backfilled.
5. The reviewed page's per-bullet So-What detail, brand-level call-outs and the
   bridge items are not stored.
