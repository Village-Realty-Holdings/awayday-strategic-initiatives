# Strategy Review: visual parity with the October 2026 reviewed report

**Status:** implemented on `feat/review-visual-parity`, not merged, not deployed.
**Reference:** `Awayday October 2026 Strategy Review.html` (72,952 bytes, dated
16 Nov 2026), read directly — CSS, theme handling, gauges, chips, tables, charts,
brand table and so-whats.
**Scope:** presentation only. No schema change, no auth change, no new
dependency, no hardcoded business figure.

---

## 1. What "parity" meant

The reviewed report is a single hand-built HTML file with a fixed October 2026
story in it. The dashboard must deliver the same *reading experience* while every
figure continues to come from `KpiDefinition` / `KpiObservation`. So parity was
pursued at the level of structure, hierarchy, vocabulary and behaviour — never by
importing the report's numbers.

Four reference behaviours drove most of the work:

1. **The report reads well in light and dark.** It declares a token palette twice
   (`@media (prefers-color-scheme: dark)` plus an explicit `:root[data-theme="dark"]`)
   and every surface, chip, table and gauge follows the tokens.
2. **Status is a vocabulary, not a colour.** `Ahead`, `On track`, `On goal`,
   `Behind`, `Under budget`, `Floor breached`, mixed chips such as
   “Behind · October beat budget”. The words carry the meaning.
3. **Numbers have hierarchy.** A large value, a smaller comparison line, small
   basis and population labels, and an explicit “—” where a figure is not loaded.
4. **Commentary is itemised.** Each so-what is a bold claim plus supporting
   evidence, with a leading indicator (`up` / `down` / `flag`) — not a paragraph.

---

## 2. Theme model

| Concern | Reference | Dashboard |
| --- | --- | --- |
| Default | System (`prefers-color-scheme`) | Same: `system` preference writes **no** `data-theme`, so the media query applies |
| Explicit choice | `data-theme="light"` / `"dark"` on `<html>` | Same attribute, set by the server before first paint |
| Persistence | Inline script + `localStorage` | `awayday_theme` cookie (`Path=/`, `SameSite=Lax`, 1 year, `Secure` on https, **not** `HttpOnly`), read in `RootLayout` |
| Flash / mismatch | Possible on first paint | None: the attribute is in the server-rendered HTML, so there is no client-side correction step and no hydration mismatch |
| System override | `:root:not([data-theme="light"])` | `html:not([data-theme="light"]):not([data-theme="dark"])` inside the dark media query, so an explicit light choice survives a dark OS |
| Print | Light | Light, always (explicit override block) |
| Selector | Not present in the report | `ThemeToggle` at **every** width: a three-option radio group (Light / Dark / System) with `aria-label="Colour theme"` and words from `sm` up, and a compact icon button below `sm` that opens a popover with the same three labelled options. Both share the cookie and the live announcement |

Why a cookie rather than the report's inline script: the application ships a CSP
that keeps `script-src 'unsafe-inline'` only because Next 16 does not propagate
nonces, and the root layout is a server component. A cookie lets the server stamp
the attribute, which removes both the flash and the mismatch without touching the
CSP or adding a client bootstrap script.

The dark palette overrides the existing tokens (`--color-bg/surface/surface-2/
border/ink/ink-muted/ink-faint/navy/teal/gold/ok/warn/risk/done` and their `-soft`
variants) as **unlayered** CSS, because Tailwind v4's `@theme` block is inside
`@layer theme` and a layered override would lose. `color-scheme: dark` is set so
native form controls, scrollbars and dialogs follow. No component contains a
literal colour; `src/lib/theme.test.ts` asserts that the gauge and report-table
blocks are styled from tokens only and computes WCAG contrast for the ink ramp and
the status colours (body text 15.6:1, card heading 13.97:1, so-what body 8.87:1,
gauge range end 6.01:1 — all above AA, most above AAA).

---

## 3. KPI status vocabulary

`src/lib/kpi-status.ts` is the single source, used by the house, exec cards,
tables, scorecards, gauges and so-whats.

| Status | Tone | Glyph | Meaning |
| --- | --- | --- | --- |
| Ahead | good | ▲ | better than the goal |
| On goal | good | ● | at the goal, inside its tolerance |
| On track | good | ● | meeting the approved plan |
| Under budget | warn (red where the rule says so) | ◆ | below the approved budget |
| Needs attention | warn | ! | needs a decision |
| Behind | crit | ▼ | worse than the goal |
| Floor breached | crit (amber where the rule says so) | ⚠ | through a defined floor |
| No data | neutral | ○ | nothing to compare |

Two rules keep it honest:

- **Direction is declared.** `metricDirection()` reads a curated list
  (churn, attrition, CAC, cost, days, incidents … are lower-is-better; margin,
  EBITDA, revenue, occupancy, retention, adds … are higher). An unknown name gets
  **no** favourable colouring rather than an invented one, which is what keeps
  “a rise in a cost line” from turning green.
- **Sign is not performance.** `favorableDelta(delta, comparator, reading)` only
  flips its reading when a *lower-is-better* metric is stored as a negative
  expense (cost of sales −17 against −15 is more spend, so it is worse). A
  higher-is-better metric that is genuinely negative keeps arithmetic meaning:
  Adjusted EBITDA of −$1.2M against a −$1.0M budget is a **wider** loss and is
  coloured red. This was found during the visual audit and fixed with a
  regression test, because the naive sign flip had painted that miss green.
- **Mixed stays mixed.** `summarizeStatuses()` produces factual wording
  (“1 of 4 measures behind · 1 not loaded”) and `MixedPerformanceChip` shows it
  beside the pillar's own status instead of collapsing to one colour — the
  reference's “Behind · October beat budget” pattern, without the hardcoded prose.

`under_budget` and `floor_breached` are the only statuses whose tone a reporting
rule may override, and an override can never turn a shortfall green.

---

## 4. Component-by-component comparison

| Component | User HTML | Updated dashboard | Result | Remaining gap |
| --- | --- | --- | --- | --- |
| Page header | Eyebrow, `h1`, lead paragraph, single-purpose page | App shell with breadcrumbs, page title, period badge, publish status; theme control in the top bar | Parity of intent | The dashboard keeps its shell (navigation, actions) where the report is a standalone file — intentional |
| Strategy house | `.house` strip: five pillars, coloured top border, name, owner, measure, big value, goal line, status chip(s), SI list | Same structure: `--house-cols` grid, per-pillar tone class on the top border, name/owner, measure name, `text-2xl` value with month label, target line, status badge + mixed chip, SI list | Close | Multi-basis values (reported *and* ex-OTA in one cell) come from two definitions and render as two rows in the scorecard rather than two lines in the house cell |
| Executive summary | Four tiles: label, large value, delta line with up/down classes | Four cards: population badge, `text-3xl` value, delta line coloured only when direction is known, basis + metric name + month, `data-exec-card` hook | Parity | A card with no comparison prints “no comparison loaded” rather than a delta |
| Pillar status table | Seven rows including multi-basis TRevPAR and margin, chip per row | Scorecard rows with the shared badge, time basis and population labelled, expected-but-missing lines shown as such | Parity | Rows exist only for definitions the month actually has |
| Financial tables | `.nums` table, `.total` rows, `pos`/`neg` classes, tight type | `.report-table`: sticky header and sticky first column from 640px, static below, tabular figures, deltas coloured by declared direction only | Parity, better on small screens | Deltas are arithmetic on two reported values and say so in the footnote; the report's percentages are not recomputed |
| Gauges | One `.gauge` per pillar with `data-gauge` JSON: actual, 2026 goal, FY27 budget, FY27 stretch; **labels overlap near the right edge** | Up to four markers from the definition's own target prose, four label lanes with a 16% minimum gap, edge-inward alignment at 7%, overflow arrows for off-scale values, `role="img"` sentence label, `<dl>` legend below 40rem | Better than the reference | Only markers the definition states are drawn; with no parseable target the gauge is omitted rather than guessed |
| Historical charts | Two inline SVG line charts with a restatement note | The application's own chart components, series from observations, missing months break the line, data table beneath | Parity | Chart styling is the app's, not the report's custom SVG |
| Brand churn | 49-row table, red ≥20% / green <10%, totals row | Searchable, sortable table with the same bands and totals, plus a count of skipped rows | Parity | The totals row's percentages remain derived, as documented in `strategy-review-parity.md` |
| So-What sections | `<ul class="plain">` with `up`/`down`/`flag` list items, bold claim then evidence | `SoWhatList`: one card per item, bold headline, `whitespace-pre-line` body, tone border + glyph + `sr-only` spoken word, tone taken from the section's status | Parity of hierarchy | Tone is derived from status; `ReviewSoWhat` has no tone column (see the AI design doc) |
| Dark mode | Token palette, dark chips, dark tables | Token palette stamped server-side, verified dark background `rgb(18,26,33)` and ink `rgb(238,242,245)` in the rendered page | Parity | The report's accent hues are tuned to its own brand palette; the dashboard keeps its existing brand tokens |
| Mobile | Report is responsive but its gauge labels collide | Desktop and 390 px verified: no page-level horizontal scroll, no overlapping or clipped labels, legend replaces labels under 40rem, tables scroll inside their own container | Better than the reference | None outstanding: the theme choice stays available on phones, and the sidebar becomes a sheet so the content column is full width |

---

## 5. Gauge geometry, in detail

`src/lib/kpi-gauge.ts` is pure and separately tested.

- **Domain repair.** A missing, inverted, zero-width or non-finite domain is
  rebuilt around the actual and its targets (`suggestDomain`), including zero for
  non-negative measures so a bar cannot flatter a shortfall.
- **Position.** Values outside the domain clamp to the ends and are flagged, so
  the component can draw ▶/◀ arrows instead of a marker in the margin.
- **Labels.** Four lanes (`above-1`, `below-1`, `above-2`, `below-2`) with a
  minimum 16% separation; a crowded lane moves to the least-recently-used free
  lane; labels within 7% of an edge align inward. This is the defect in the
  reference screenshot (three labels stacked on the same spot at the right) fixed
  by construction, and `kpi-gauge.test.ts` asserts lane separation for clustered
  targets and four-lane reuse for six near-identical ones.
- **Formatting.** Currency, percent, points, counts and plain numbers, with the
  unit inferred from how the value and target are already written (`inferGaugeFormat`),
  and fraction-percent handled.
- **Multi-target.** `parseTargetMarkers()` reads labelled figures out of the
  definition's target prose (“23% budget; 28% stretch”, “$26M total; $11M via
  tuck-ins; $47M stretch”) and ignores an unlabelled component figure rather than
  plotting it as a second goal. Signed targets (“+0.25% budget”) are read too.
- **Mismatch guard.** `looksLikeDifferentQuantity()` refuses to draw a gauge when
  one side is a percentage and the other is not and the magnitudes are more than
  100× apart — a level plotted against growth percentages would produce a
  meaningless axis.
- **Missing data.** No actual or no numeric target → no gauge, and the section
  shows the status badge and the reason instead.

---

## 6. Verification performed

Local Postgres (`awayday_si_dev`, synthetic definitions and observations; never
Neon), `next dev`, headless Chrome over the DevTools protocol with
`prefers-color-scheme` emulated per run.

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | 62 files, 707 tests passing |
| `npm run build` | succeeds, routes unchanged |
| Page-level horizontal scroll at 390 px | 0 px, light and dark |
| Gauge label overlaps / clipping | none, desktop and mobile |
| Mobile gauge fallback | legend shown, labels hidden below 40rem |
| Tables | sticky header + first column at 1440 px; static and container-scrolled at 390 px |
| Dark theme | `data-theme` absent with `system`, media query applies; background `rgb(18,26,33)`, ink `rgb(238,242,245)` |
| Theme selection, live | Clicking Dark sets `data-theme="dark"`, writes `awayday_theme=dark`, background becomes `rgb(18,26,33)` and the live region announces “Dark theme selected” |
| Theme persistence | After a reload with the OS still light, the page paints dark from the server-rendered attribute — no flash, no correction step |
| Explicit light over a dark OS | `data-theme="light"` with `prefers-color-scheme: dark` stays light |
| System after a choice | Selecting System removes the attribute and the page follows the OS again (dark background under a dark OS) |
| Statuses rendered | ahead 27, behind 13, on track 19, no data 48 |
| Theme control at 390 / 768 / 1440 px | compact button / segmented / segmented — never both, never neither |
| Header height at 390 px | 56 px (was 77 px when both controls rendered) |
| Mobile theme selection | Light, Dark and System each selectable from the popover; cookie written; announced |
| Mobile theme persistence | Reload keeps the choice, painted from the server-rendered `data-theme` |
| Mobile keyboard access | Enter/Space open the popover, arrow keys change the choice, Escape returns focus to the trigger |
| Gauge accuracy | six pillar/enabler gauges; every marker inside its axis |
| Delta tones | favourable 20, unfavourable 31, neutral 15 |
| So-what tones | neutral and negative sections both rendered |
| Contrast (AA) | all sampled text ≥ 6.01:1 |

Screenshots were captured at `/tmp/rev-{light,dark}.png` (1440 px) and
`/tmp/rev-mobile-{light,dark}.png` (390 px), with the reference at
`/tmp/ref-{light,dark}.png`; they are local artefacts and are not committed.

---

## 7. Intentional differences

1. **The report is one month; the dashboard is any month.** Every label that the
   report hardcodes (“October”, “FY27 stretch”) is derived from the selected
   period or from a definition.
2. **The report states a single verdict per pillar; the dashboard can state two.**
   Where a pillar's rows disagree, both the owner status and a factual mixed chip
   appear. No prose verdict is generated.
3. **The report's tiles always have a delta; the dashboard says “no comparison
   loaded”** when the comparison identity is absent. Missing data is shown, not
   filled.
4. **The dashboard keeps its navigation, actions and edit affordances.** Parity of
   reading experience, not of page furniture.
5. **Colour is never the only signal.** Every status carries a glyph and a word,
   gauges carry a sentence label, and so-whats carry a spoken tone word.
