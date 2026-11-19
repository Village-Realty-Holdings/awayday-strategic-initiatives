# ADR 0003 — Direction is declared, and a pillar's primary measure is an active mapping

- **Date:** 2026-11-18
- **Status:** Proposed (awaiting engineering review; the migration has not been
  applied to production)
- **Scope:** `KpiMeasureMapping` schema (engineering-owned), Strategy Review read
  and write paths, Admin > Measure mappings

## Context

Two integrity defects remained in the Strategy Review after the visual-parity
work:

1. **`KpiMeasureMapping.higherIsBetter` defaulted to `true`.** A mapping created
   without an explicit choice therefore declared that higher was better. For
   owner churn, customer acquisition cost, operating expenses, unit losses and
   cancellation rates that is silently wrong, and a rise in a bad number could
   be painted green. The form also coerced anything other than `LOWER` to
   `true`, so even a malformed request produced a direction.
2. **A pillar's measure was `kpis[0]` from a name-ordered query.** Renaming a
   KPI, adding a supporting metric or any change in sort order could change
   what the strategy house presented as the pillar's headline measure. Edit Mode
   wrote to the same position, so a hand-entered value could land on a different
   KPI than the one displayed.

Both are presentation/governance rules rather than calculation changes: no KPI
value is recalculated or rewritten, and no existing observation is modified.

## Decision

### 1. Direction is tri-state and has no default

- `KpiMeasureMapping.higherIsBetter` becomes `Boolean?` with **no** `@default`.
  The three states are meaningful: `true` (higher is better), `false` (lower is
  better), `null` (not stated).
- The Admin form offers Higher / Lower / **Not stated (no status colour)**. The
  server action accepts only `HIGHER`, `LOWER` or blank; an unknown value is
  rejected. No code path maps "missing" to `true`.
- `null` produces a neutral status everywhere: `mappingRag()` returns `GREY`,
  the gauge says "Direction not stated", and `resolveDirection(null, name)`
  returns `known: false` rather than falling back to the measure's name.
  `undefined` (no mapping at all) still falls back to the name, so metrics that
  were never mapped keep their existing name-derived colours.
- An explicit statement in a target (`<12%`) still wins for the gauge, because
  it is the definition's own declaration.

**Existing data is not reinterpreted.** The migration only drops the default and
the NOT NULL constraint; stored `true`/`false` values are preserved. A stored
`true` cannot be distinguished from one supplied by the old default, so no
guessed backfill is performed. Any correction is made deliberately through
Admin > Measure mappings (audited) or a future migration that names each KPI
and its approved direction.

### 2. The primary measure is the KPI with the active mapping

- Reuse `KpiMeasureMapping` rather than add a second model or a parallel
  "primary" flag. A mapping is already the deliberate, admin-owned statement of
  how a pillar's measure is configured (targets, time basis, direction, inputs).
- `selectPrimaryMeasure()` reads only persisted mappings:
  - exactly one active mapping in the pillar → that KPI is primary;
  - none → `missing` (neutral);
  - more than one → `ambiguous` (neutral, conflicting names shown; no
    alphabetical tie-break).
- Read (`getReviewPlan`) and write (`setPillarMeasure`) paths call the same
  resolver, so the displayed measure and the edit target cannot drift.
- Admin > Measure mappings lists every KPI, marks primary/supporting, and
  refuses to activate a second mapping in the same pillar. Changing which KPI is
  primary therefore requires an admin to switch one mapping off and another on,
  both audited.
- A pillar with no primary still shows its plan-declared measure name but no
  value, no comparison and a `no_data` status. A hand-set owner status
  (`ReviewPillarStatus`) remains untouched.

## Consequences

- **Schema change:** one column becomes nullable and loses its default. The
  migration is prepared in
  `prisma/migrations/20261118220000_kpi_mapping_direction_optional/` and has been
  applied only to the local development database. Engineering approval is
  required before it reaches staging or production.
- **Rollback:** additive and non-destructive. Rolling back the application
  leaves existing `true`/`false` values readable; re-adding the default would be
  a separate, explicit migration.
- **Behavioural change:** pillars and enablers with a KPI but no active mapping
  no longer show a status calculated from the alphabetically first KPI. They
  show the neutral "primary measure not configured" state. This is the intended
  governance outcome, and is visible in the local preview for three enablers.
- **No new dependency, auth change or reporting-population change.** Population,
  time-basis and comparison-basis rules are untouched; direction never overrides
  identity.
- **Tests:** regression suites cover explicit higher/lower, unknown direction,
  new mappings without a direction, negative EBITDA and expenses, churn/CAC,
  percentage-point comparisons, authorised direction changes, and primary
  selection under rename/add/reorder/delete/missing/ambiguous conditions. A
  source guard fails if `kpis[0]` or a `take: 1` KPI query returns to
  application source.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — see
  `STATUS.md` for the recorded results.
- Local preview against synthetic Postgres (`awayday_si_dev`): the five pillars
  resolve their configured measures; a temporarily cleared direction rendered
  the neutral gauge and basis text, then restored; approved pillar statuses were
  unchanged throughout.
- Production Neon was not connected to, read from, or modified.
