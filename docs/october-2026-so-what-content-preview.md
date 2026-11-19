# October 2026 So-What commentary — exact content preview (nothing imported)

**Status: preview only. Nothing in this file has been written to any database.**
Production was not accessed; the local development database was not altered in this
pass.

## Provenance

Transcribed programmatically from the supplied reference page
`Awayday October 2026 Strategy Review(2).html` (held outside the repository in
`.reference/`, which is gitignored — it contains business financial content and is
never committed). Every headline and body below is the page's own text, character
for character, including its numbers and punctuation. Nothing was paraphrased,
generated, rounded or reconstructed. No Claude/Anthropic call, credential, prompt or
job is involved anywhere in this feature.

Section order follows the page. Scopes are the application's existing scope codes
plus `FINANCIALS` for the bridge block (added with the `SoWhatTone` migration).

## Tone: how the page's colours become stored values

The page marks each item with a CSS class. Those class names are presentation, so
they are **not** stored. Each maps to one semantic value:

| Page class | Meaning on the page | Stored `SoWhatTone` |
| --- | --- | --- |
| `up` | good news (green) | `POSITIVE` |
| `down` | bad news (red) | `NEGATIVE` |
| `flag` | watch item (amber) | `WARNING` |
| — (no class) | plain note | `NEUTRAL` |

The renderer maps the stored value back to a presentation tone; a row with no tone
(`NULL`) inherits its section's tone, which is why every existing row keeps the
presentation it had before the migration.

## What the page contains, and what the database holds

| Scope | Section on the page | Items on the page | Rows stored today | Gap |
| --- | --- | ---: | ---: | --- |
| `SUMMARY` | "So what" (executive) | 4 | 4 | tones |
| `FINANCIALS` | "So what in the bridge (October vs budget)" | 4 | **0** | **4 rows, all missing** |
| `M&A` | Pillar 1 · M&A | 4 | 4 | tones |
| `GROW` | Pillar 2 · Grow New Units | 4 | 4 | tones |
| `RETENTION` | Pillar 3 · Owner Retention | 4 | 4 | tones |
| `TREVPAR` | Pillar 4 · TRevPAR Expansion | 4 | 4 | tones |
| `MARGIN` | Pillar 5 · Margin Expansion | 4 | 4 | tones |
| `GUEST` | Guest Experience | 5 | 5 | tones |
| **Total** | 8 sections | **33** | **29** | **4 rows + 33 tones** |

The 29 stored rows match the page's wording exactly, with one typographic
difference: the page's bold headline ends with a full stop (for example
"…went negative."), while the stored `headline` omits it. Because the renderer prints
the headline and the body as separate blocks, the full stop is the only visual
difference; it is recorded here rather than "fixed" by rewriting 29 stored rows.

## The preview — all 33 items, in page order

Columns: the scope the row belongs to, its `order` within that scope, the tone to
persist, and the page's exact headline and body.

| # | Section scope | Order | Tone (persisted) | Headline (exact) | Body (exact) |
| ---: | --- | ---: | --- | --- | --- |
| 1 | `SUMMARY` | 0 | **NEGATIVE** (bad news) | Shop NOI missed budget and Adj. EBITDA went negative. | Shop NOI was $0.6M under budget, $0.5M of it the hurricane in NE and NW Florida. Support ran $0.5M over and BD $0.7M over, so Adj. EBITDA was −$1.2M against a +$0.6M budget. YTD is still $2.7M ahead. |
| 2 | `SUMMARY` | 1 | **POSITIVE** (good news) | M&A stays well ahead of goal. | 21 deals and $34.8M of acquired EBITDA closed, against a $23M goal. One close in October (CooperWynn, $0.3M); five LOIs signed in the month, taking the LOI book to 10 deals and $8.8M. |
| 3 | `SUMMARY` | 2 | **POSITIVE** (good news) | Churn beat budget for a second month running, still behind on the year. | 12.2% annualized in October vs an 18.4% budget (149 units vs 211). YTD is 12.4% vs 11.5% budget; LTM holds at 13.0%. |
| 4 | `SUMMARY` | 3 | **NEGATIVE** (bad news) | Cash CAC is over budget for a fourth month. | $7,306 in October, 45% over the $5,046 budget, driven by new owner guarantees and accelerator bonuses. Organic adds were 260, 4 under budget. |
| 5 | `FINANCIALS` | 0 | **NEGATIVE** (bad news) | Rent was under budget, fees held revenue up. | Commission revenue −$0.2M on rent $0.9M under budget; guest fees $0.9M over. Revenue still beat budget by 5.7%, but expenses ran 10.4% over. |
| 6 | `FINANCIALS` | 1 | **NEGATIVE** (bad news) | OTA and maintenance margins missed. | OTA margin −3.2% vs 5.9% budget (−$0.2M); maintenance margin −20.0% vs −10.3% budget (−$0.1M). Amenity fee expense and uncollected guest damage added −$0.3M in other cost of sales. |
| 7 | `FINANCIALS` | 2 | **NEGATIVE** (bad news) | Support and BD spend took EBITDA below zero. | Support labor and other $0.5M over budget (wages $0.25M, bonus $0.19M). Shop BD $0.6M over, on new unit referral royalties ($0.23M) and new owner guarantees ($0.18M). |
| 8 | `FINANCIALS` | 3 | **NEGATIVE** (bad news) | Regions vs budget, YTD Adj. EBITDA (Ares pack): | behind Colorado −$1.8M, Central Highlands −$1.3M, South Carolina −$0.9M, Southwest −$0.3M; ahead NE Florida +$4.9M, NW Florida +$1.7M, Pacific NW +$0.8M, North Carolina +$0.4M. In October alone NE Florida was −$0.4M and NW Florida −$0.3M (hurricane); Pacific NW was +$0.3M. |
| 9 | `M&A` | 0 | **POSITIVE** (good news) | One close in October: | CooperWynn Property Management (Park City), a tuck-in to All Seasons Park City. 51 units, $0.3M, 3.9x, closed 13 Oct. |
| 10 | `M&A` | 1 | **POSITIVE** (good news) | Five LOIs signed in October: | STAY Newport (RI beachhead), Sand Seeker (PCB tuck-in), Sun Surf Realty (Atlantic Beach tuck-in), Renting The Coast (Port St. Joe tuck-in) and Coastal Vacation Properties (Fort Myers fill-in). The rest-of-year plan is 28 deals closed: about 5.9k units and $40.3M pro forma. |
| 11 | `M&A` | 2 | **WARNING** (watch item) | Cycle time is still the gap. | Median days to close across the 11 tuck-ins is 81 against a 30 to 45 day target; CooperWynn took 95. The three October tuck-in LOIs target closes in 43 to 63 days. |
| 12 | `M&A` | 3 | **WARNING** (watch item) | Large deals in play: | Natural Retreats ($14.0M Adj. EBITDA, 1,400 units) is in the final stages of the LOI process and makes up most of the $22.1M of offers out. Vtrips ($19M EBITDA) launches a formal process in January 2027. Tuck-ins are $4.2M of the year so far against the ~$11M FY27 needs (a third of ~$33M). |
| 13 | `GROW` | 0 | **POSITIVE** (good news) | Volume is still ahead, by less than earlier in the year. | 330 adds vs 295 budget on the BD Master (+12%, against +28% YTD). On Finance's basis organic adds were 260, 4 under budget, the first month under this year. |
| 14 | `GROW` | 1 | **NEGATIVE** (bad news) | Cost per add keeps rising. | $7,306 vs $5,046 budget in October; $6,563 YTD vs $5,352. BD spend is $3.0M over budget YTD. Furthest over on CAC YTD: Southwest $8,305 (+80%), Western Rockies $5,466 (+76%), Pacific NW $7,629 (+63%), NW Florida $8,109 (+49%). Central Highlands is the one region under budget. |
| 15 | `GROW` | 2 | **POSITIVE** (good news) | Adding most in October (AwayDNA): | RealJoy 40, Resort Rentals 17, Great Ocean Condos 14, Sun Palace 13, Avada 12. |
| 16 | `GROW` | 3 | **NEGATIVE** (bad news) | Adding none: | Emerald Coast Retreats, Blue Moon, Stay Better, Steamboat Lodging, Lodging in Telluride. |
| 17 | `RETENTION` | 0 | **POSITIVE** (good news) | Second month running under budget: | 149 units churned vs 211 budget. LTM churn held at 13.0%, down from 13.5% at Nov-25. |
| 18 | `RETENTION` | 1 | **NEGATIVE** (bad news) | Luxury Beach is the October outlier: | 22 units churned in the month on 237 bookable units, taking it to 38% over the trailing year. In Finance's shop table its LTM churn jumped from 58 to 73 units. |
| 19 | `RETENTION` | 2 | **NEGATIVE** (bad news) | Avada still carries the most churn, | but it slowed: 4 units in October after 13 in September, and LTM is down from 179 to 174. On today's 306 bookable units that is 57% over the trailing year. Scottsdale (42%), Carolina Beach (32%) and Stay Local Austin (29%) are next. |
| 20 | `RETENTION` | 3 | **WARNING** (watch item) | Just over half of churn is ours to fix. | 758 of the 1,419 units lost YTD are classed shop at fault; "fired for revenue" is the largest single reason at 248. By region, Southwest (31% annualized), Central Highlands (25%) and South Carolina (24%) run at roughly double the 12% total. |
| 21 | `TREVPAR` | 0 | **NEGATIVE** (bad news) | October came in under budget and under prior year. | Reported TRevPAR $99.2 vs $105.7 budget (−6.2%) and $100.1 PY (−0.9%). ADR fell 6.8% to $206 and occupancy was flat; the hurricane took nights out of NE and NW Florida. |
| 22 | `TREVPAR` | 1 | **WARNING** (watch item) | YTD growth is fees and the pass-through, not rate. | Reported is +4.1% YTD; with the Airbnb pass-through removed it is +0.6% and 1.0% under budget. ADR is down 4.8% YTD, fees per night are up 17.3%, occupancy is up 1.3 pt. |
| 23 | `TREVPAR` | 2 | **POSITIVE** (good news) | Beating market | (October Adj. TRevPAR vs PY, each shop against its own market, Ares pack): SummitCove +70% vs market +22%, Spinnaker's Reach +58% vs −1%, Lodging in Telluride +43% vs +3%, All Seasons Santa Fe +31% vs −3%, Village Realty +27% vs −4%. |
| 24 | `TREVPAR` | 3 | **NEGATIVE** (bad news) | Trailing market | (same basis): Resort Rentals +10% vs market +61%, All Seasons Park City −13% vs +20%, Holiday Isle −17% vs −1%, RealJoy Destin −14% vs +2%, Emerald Coast Vacation Rentals −20% vs −5%. The last three are in the hurricane zone. |
| 25 | `MARGIN` | 0 | **POSITIVE** (good news) | Like-for-like shop margin is still up on last year. | Ex-OTA shop NOI margin was 17.1% in October vs 16.6% PY and is 36.9% YTD vs 36.1%. Against budget October missed by 2.9 pt, mostly the hurricane; with the $1.2M addback Shop NOI would have been $0.6M over budget. |
| 26 | `MARGIN` | 1 | **NEGATIVE** (bad news) | The margin pressure sits below shop NOI. | Support cost is $31.1M YTD, 7.9% over budget, and BD is $12.7M, 30.7% over. Adj. EBITDA margin is 22.6% YTD vs 26.4% PY. |
| 27 | `MARGIN` | 2 | **NEGATIVE** (bad news) | Two sub-margins miss budget again: | maintenance margin −20.0% vs −10.3% budget and worse than PY (−5.4%); OTA margin −3.2% vs 5.9% budget, though better than PY (−6.5%). OTA expense ran $0.46M over budget against $0.26M more OTA revenue. |
| 28 | `MARGIN` | 3 | **NEGATIVE** (bad news) | Shops furthest under NOI budget YTD: | Luxury Beach −$0.9M, Avada −$0.7M, Park City Rental Properties −$0.7M, Great Western −$0.4M, Rent Branson −$0.4M, Stay Local Austin −$0.4M. Furthest ahead: RealJoy Destin +$2.2M, RealJoy PCB +$1.0M, Oregon Beach +$1.0M. |
| 29 | `GUEST` | 0 | **NEGATIVE** (bad news) | October slipped back under the standard. | Monthly scores ran 4.58, 4.61, 4.65 in July to September and 4.64 in October. October last year was 4.69. |
| 30 | `GUEST` | 1 | **NEGATIVE** (bad news) | Lowest in October (100+ reviews): | Amazing Views 4.21, Pensacola Beach 4.24, Emerald Coast Vacation Rentals 4.38, Avada 4.45, RealJoy Destin 4.47, Carolina Beach 4.49, Luxury Beach 4.49. Pensacola Beach, Emerald Coast and RealJoy Destin are in the hurricane zone; Pensacola Beach is 4.51 on the trailing year. |
| 31 | `GUEST` | 2 | **POSITIVE** (good news) | Highest in October (100+ reviews): | Bach Bros 4.95, Cohost 4.94, Sedona 4.86, Stay Winter Park 4.82, SummitCove 4.80, Ocracoke 4.79, NXT 4.78. |
| 32 | `GUEST` | 3 | **WARNING** (watch item) | Same six brands under the floor as in September. | Amazing Views fell furthest in the month (4.36 to 4.21) and is the lowest on a trailing year. |
| 33 | `GUEST` | 4 | **WARNING** (watch item) | Where these scores come from: | read directly from DOMO (Reviews dataset), a manual pull each month until a review-score metric is added to the semantic layer. |

## How this would be applied (not done)

1. **Rows** — the 4 `FINANCIALS` items are created for period `2026-10` (DRAFT) with
   `order` 0–3, through the review editor or the MCP `set_so_whats` tool, both of
   which already accept the `FINANCIALS` scope and a per-item `tone`.
2. **Tones** — the 33 rows above get their `SoWhatTone`; the remaining `NULL` rows,
   if any, keep inheriting their section's tone.
3. **Confirmation** — the editor replaces a scope's rows as a set, so each section is
   previewed against this table and confirmed section by section.
4. **Audit** — `setSoWhats` writes headline and tone to the audit trail, so the
   before/after of every section is recoverable.
5. **Rollback** — re-save the prior rows from the audit trail; no schema change is
   involved.

## Explicitly not done

- No row was inserted, updated or deleted in any database.
- No production read or write; no import script; no bulk edit.
- No AI generation, no model endpoint, no credentials.
- The reference HTML and the production identity JSON stay outside git
  (`.reference/`, gitignored).
