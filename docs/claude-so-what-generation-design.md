# Claude-generated So-What commentary: design proposal

**Status:** proposal only. Nothing in this document is enabled. No generation
job, route, migration or prompt ships with this branch, and no AI-authored text
can reach a published review through any path that exists today.

**Date:** 18 November 2026
**Author:** engineering (agent-assisted), for business + engineering review
**Related:** [strategy-review-parity.md](strategy-review-parity.md),
[ADR 0002](adr/0002-reviewed-report-presentation.md), `prisma/schema.prisma`,
`src/lib/ai.ts`, `src/app/(app)/review-actions.ts`, `src/lib/mcp.ts`

---

## 1. Why this document exists

The business user currently writes the So-What commentary for each monthly
Strategy Review by hand, working with Claude in a chat window and pasting the
result into the review. They want that drafting step automated: Claude reads the
month's approved KPI results and proposes commentary, which a person reviews,
edits and approves.

This document specifies that workflow, the data and security controls it needs,
and the questions that must be answered before anyone builds it. It deliberately
stops short of implementation.

**The single most important finding:** the current `ReviewSoWhat` table cannot
hold a draft. Every row in it *is* published review content, and the table has no
status, provenance, tone or source-reference columns. Section 4 sets out the
options; all of them need an engineering decision, and most need a migration.
That is a stop condition under AGENTS.md, not something to improvise.

---

## 2. What already exists

Nothing below needs to be invented. The design reuses it.

### 2.1 Commentary storage

```prisma
model ReviewSoWhat {
  id        String       @id @default(cuid())
  periodId  String       // ReviewPeriod.id — "YYYY-MM"
  period    ReviewPeriod @relation(...)
  scope     String       // "SUMMARY" or a pillar code
  order     Int          @default(0)
  headline  String
  body      String?      @db.Text
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  @@index([periodId, scope, order])
}
```

Limits enforced at the edges: `SO_WHAT_LIMITS = { perScope: 12, headline: 200,
body: 2000 }` (`src/lib/review-model.ts`). `body` is plain text rendered with
`whitespace-pre-line`; it is never interpreted as HTML, Markdown or a template.
That must not change (AGENTS.md forbids storing page/email/HTML templates or
executable content in database fields).

### 2.2 Publication state

`ReviewPeriod.status` is `DRAFT | PUBLISHED`, with `publishedAt` / `publishedBy`.
`saveReview` (`src/app/(app)/review-actions.ts`) refuses to edit a published
month, and publishing is an explicit `intent=publish` on the same form. The
dashboard only renders so-whats for the period it is showing; the *month* is the
publication unit, not the individual comment.

### 2.3 Editorial surfaces

| Surface | Who | What it can do |
| --- | --- | --- |
| `/review/[period]/edit` (`saveReview`) | `admin` | Replaces all so-whats for the summary and every pillar in one transaction; publishes; audits before/after |
| MCP `set_so_whats` | `editor` (write scope) | Replaces all so-whats for one scope in a month |
| MCP `get_review` | `editor` | Reads the month, pillars and existing so-whats |
| MCP `set_pillar_measure`, `update_review_details` | `editor` | Pillar value/status and review metadata |

Both write paths are replace-the-whole-list and both are audited
(`audit(userId, "UPDATE", "ReviewPeriod", id, { before, after })`). Neither has a
draft concept: what is written is what the dashboard shows.

### 2.4 KPI data with the provenance the generator needs

`KpiObservation` already carries what a trustworthy draft requires:

- `reportingPeriod` (`"YYYY-MM"`), `observedAt`, `refreshedAt`
- `timeBasis` (`MONTHLY | YTD | LTM | TTM | POINT_IN_TIME`),
  `comparisonBasis` (`ACTUAL | BUDGET | PRIOR_YEAR`)
- `reportingScope` / `entityScope` / `entityId` — the population, which is why
  Base Business, reported, ex-OTA, AwayDNA and consolidated figures must never be
  blended
- `publicationState`, `revision`, `supersededAt` — revision awareness and
  supersession
- `quality` (`VALID | … | INVALID | UNAVAILABLE`)
- `sourceRef`, `sourceDocumentId`, `sourceDocumentName`, `sourceDocumentVersion`,
  `sourceContentHash`, `sourceCategory`, `sourceLocation`, `evidence`,
  `extractionRunId`, `authorityRank`, `valueDerivation`

Because of these fields a draft can name the exact observation it is based on,
and the review screen can refuse to show it if that observation has since been
superseded.

### 2.5 An existing, governed model call

`src/lib/ai.ts` provides `complete({ system, user, maxTokens, context, model,
timeoutMs, maxRetries })` on the server with:

- `ANTHROPIC_API_KEY` read from the environment only (never a database column,
  never returned to a client);
- `ANTHROPIC_MODEL` override, default `claude-sonnet-5-5`;
- model-specific `thinkingParams`;
- `HOUSE_STYLE` house voice prompt;
- `recordAiInvocation` telemetry (`AiModule`, token counts) and
  `assertAiBudget` (`AI_MONTHLY_BUDGET_USD`, alert recipients);
- `classifyAiError` for user-safe failures.

`aiConfigured()` (same module) lets the UI hide the feature cleanly when no key
is configured. `KpiCommentary` (per-KPI, `modelId`, `promptVersion`,
`extractionRunId`) exists in the schema and is currently unused by application
code — a useful precedent for provenance columns, but it is per *KPI*, not per
review scope, so it is not a draft store for so-whats.

### 2.6 Status vocabulary added by this branch

`src/lib/kpi-status.ts` now gives one vocabulary (`ahead`, `on_goal`, `on_track`,
`behind`, `under_budget`, `needs_attention`, `floor_breached`, `no_data`), a tone
mapping, declared metric direction, and mixed-performance summaries. Generated
commentary must consume these rather than deciding for itself whether a number is
good news — see §6.4.

---

## 3. Proposed workflow

```
 approved/current observations for the month
                │
                ▼
   ┌───────────────────────────┐
   │ 1. eligibility + snapshot │  server, admin- or editor-triggered
   └───────────┬───────────────┘
               ▼
      immutable GenerationInput (period, scope, rows, ids, revisions, hash)
               │
               ▼
   ┌───────────────────────────┐
   │ 2. Claude draft           │  src/lib/ai.ts complete(), budgeted
   └───────────┬───────────────┘
               ▼
   ┌───────────────────────────┐
   │ 3. validation             │  length, grounding, direction, scope
   └───────────┬───────────────┘
               ▼
      DRAFT (stored separately from published content)
               │
               ▼
   ┌───────────────────────────┐
   │ 4. human review/edit      │  accept / edit / reject, per item
   └───────────┬───────────────┘
               ▼
   ┌───────────────────────────┐
   │ 5. approve → publish      │  existing publish path, existing audit
   └───────────┬───────────────┘
               ▼
   dashboard shows approved commentary
        ▲
        └── 6. regenerate = new draft only; approved rows are never touched
```

### Step 1 — Eligibility and snapshot (server, deterministic)

Selected period `P`. Include only observations where:

- `publicationState = APPROVED` and `supersededAt is null`;
- `quality not in (INVALID, UNAVAILABLE)`;
- `reportingPeriod = P` (comparisons such as YTD/prior year are separate rows
  with their own identity — never derived by arithmetic in the prompt);
- the definition is active for the month and belongs to the review plan.

The snapshot is a server-built JSON structure: one entry per row with definition
name and reporting definition text, value, unit, time basis, comparison basis,
reporting scope, entity scope, `observationId`, `revision`, `observedAt`,
`authorityRank`, `sourceRef` and computed `status` (from `kpi-status.ts`) where a
target exists. Nothing else — no free text from uploaded documents, no raw
spreadsheet cells, no attachment bodies.

Hash the snapshot (`sha256` over a canonical serialisation). The hash plus the
row identities are the draft's provenance.

### Step 2 — Draft generation

One call per scope (summary, then each pillar), so a long report does not depend
on one enormous completion and a failure is local. Input: `HOUSE_STYLE`, a
purpose-specific system prompt, the snapshot for that scope, and the existing
approved commentary for *context only* (so tone stays consistent, explicitly not
as instructions). Output: a JSON array of
`{ headline, body, statusRefs: string[], observationRefs: string[] }` — one item
per point the numbers actually support, at most `SO_WHAT_LIMITS.perScope`.

### Step 3 — Validation before storage

Rejected items are reported to the reviewer, not silently dropped:

| Check | Rule |
| --- | --- |
| Length | `headline ≤ 200`, `body ≤ 2000`, non-empty headline |
| Grounding | every number in the text must appear in the snapshot (numeric tolerance 0) |
| Attribution | every `observationRefs` entry must be in the snapshot; at least one required |
| Direction | an “ahead/good” claim must reference a row whose computed status tone is `good`; “behind/bad” a `crit` row; no claim may contradict a `no_data` row |
| Scope | text may not mention a population outside the scope's snapshot (no “consolidated” claims in a Base Business scope) |
| Prohibited content | no forward-looking commitments, no guidance, no projections absent from an approved observation, no named individuals |
| Format | plain text only; no HTML, Markdown, links, tables or code |
| Style | house style: no em dashes, no exclamation marks |

### Step 4 — Human review

The reviewer sees each draft item beside the rows it cites: value, comparison,
status, population, period. Actions per item: **Accept**, **Edit** (creates a
human revision), **Reject** (with optional reason). Accepting all is a single
action, and nothing is published by it.

### Step 5 — Approval and publication

Approval moves the reviewed items into the month's so-whats through a single
replacement in one transaction, exactly like `saveReview` today, and then the
existing publish action makes them visible. Approver must be `admin` (the same
role that can publish today). Publication stays a separate, deliberate click.

### Step 6 — Regeneration

Regeneration writes a *new* draft version for the scope. Approved or published
items are immutable from the generator's point of view: the generate step never
targets a published period, and the approve step refuses when
`ReviewPeriod.status = PUBLISHED`. Re-running after publication produces a draft
that can only be used to prepare a correction, which requires the existing
unpublish-then-edit path (admin) — a person, not the model, decides that.

---

## 4. Can `ReviewSoWhat` support this without a migration?

**No.** Concretely, what is missing:

1. No draft/approved state. Every `ReviewSoWhat` row is content the dashboard
   renders. Writing a draft into that table would publish it.
2. No provenance. There is nowhere to record `modelId`, `promptVersion`, the
   snapshot hash, the cited `observationId`s/revisions, or who approved what and
   when.
3. No history. `saveReview` and `set_so_whats` delete-and-recreate; there is no
   per-item revision to compare a draft against, and no place for a rejected
   item and its reason.
4. No tone. This branch renders tone from the *section's status*, not from stored
   data, because there is no column for it. A generated item's tone would
   therefore be recomputed rather than reviewed — acceptable for display, not
   sufficient as a record of what a person approved.

Options, in ascending cost:

| Option | Migration | Meets “drafts stored separately”? | Protection against overwriting approvals | Verdict |
| --- | --- | --- | --- | --- |
| **A. No schema change.** Drafts live only in the generation run (returned to the browser, never stored); publishing pastes them into `saveReview`. | none | No — drafts vanish on refresh, so review cannot be resumed and there is no audit of what was proposed | Weak: nothing records that published text came from a draft | Only acceptable as a demo; not recommended |
| **B. New `ReviewSoWhatDraft` table** (period, scope, order, headline, body, `statusRefs`, `observationRefs`, `snapshotHash`, `modelId`, `promptVersion`, `state` enum, `reviewedBy`, `reviewedAt`, `rejectedReason`, `generationRunId`) keyed by `(periodId, scope, generationRunId)`. Published content stays in `ReviewSoWhat` exactly as today. | **yes** — additive table + enum | Yes | Yes: publish copies rows; `ReviewSoWhat` rows are only ever written by a human action | **Recommended** |
| **C. Status column on `ReviewSoWhat`** (`state: DRAFT | APPROVED`) plus filter in every reader. | yes — column + backfill | Partly | Risky: every existing reader (dashboard, MCP, export) must be taught to filter, and one missed filter publishes drafts. Also rewrites the semantics of an existing table. | Not recommended |
| **D. Reuse `KpiCommentary`** | none | No — it is per-KPI, not per review scope, has no state and no scope column | No | Not suitable |

**Recommendation: option B, with option A available immediately behind a flag as
a demo only.** Option B needs engineering approval because it is a schema change;
per AGENTS.md a migration is a stop-and-ask boundary, and it was not added in this
branch.

Two smaller decisions that also affect the design:

- **Tone storage.** If generated items are to carry a reviewed tone, add a
  nullable `tone` to the draft table (and, only if the business wants to override
  tone on published commentary, to `ReviewSoWhat` as well). Until then, tone is
  derived from the section's status, which is honest but not reviewable.
- **Retention.** Drafts, rejected items and snapshots will accumulate. Agree a
  retention window (e.g. keep the approved generation run for the month plus the
  last two rejected runs) and a purge that is not part of a request path.

---

## 5. Data integrity controls

| Requirement | Control |
| --- | --- |
| Source references | Each draft stores the `sourceRef`s of the rows it cites, and the reviewer sees them; published commentary keeps a link to the generation run |
| Reporting-period identity | Snapshot is built from `reportingPeriod = P` only; the draft records `periodId`; a mismatch is a hard error |
| KPI observation references | `observationId` + `revision` per cited row; validation requires at least one |
| Reporting-scope awareness | Snapshot rows carry `reportingScope`/`entityScope`; one scope per generation; scope-crossing text is rejected |
| Revision awareness | Draft records each cited `revision`; if a cited observation gains a new revision or `supersededAt` before approval, the draft is marked **stale** and approval is blocked until regenerated |
| Protection against outdated observations | The snapshot hash is re-derived at approval time; if the eligible set changed, approving requires an explicit “accept stale” by an admin, recorded in the audit entry (default: block) |
| No unsupported financial claims | Grounding rule (§3 step 3): every number must exist in the snapshot with the same unit and basis; projections and guidance are prohibited; the validator is deterministic and testable, not a second model |
| Missing data | A `no_data` row may be mentioned only as missing (“not loaded for October”); it may never be given a value or a status |
| Mixed performance | Where a pillar's rows disagree (one ahead, one behind), the prompt must state both sides and the summary chip must not be flattened into one verdict — the `summarizeStatuses`/`isMixed` helpers already produce that wording |
| Currency/units | Values are formatted upstream (`formatMetricValue`) and passed as strings with their unit; the model is not asked to convert units or currencies |

---

## 6. Editorial workflow

| Action | Role | Records |
| --- | --- | --- |
| Generate draft | `admin` (recommended) or `editor` with write scope | `generationRunId`, model, prompt version, snapshot hash, token use, cost |
| View draft | same as generate | — |
| Edit a draft item | `admin`, `editor` | original text kept, edited text stored, editor id, timestamp |
| Reject a draft item | `admin`, `editor` | reason, reviewer id |
| Accept draft into the month | `admin` | moves items into `ReviewSoWhat`, keeps provenance link |
| Publish | `admin` — existing action, unchanged | `publishedAt`, `publishedBy`, before/after audit |
| Regenerate | `admin`, `editor` | new `generationRunId`; previous drafts retained |
| Unpublish / correct | `admin` — existing action, unchanged | audit before/after |

Audit: reuse `audit()` with `entity = "ReviewSoWhatDraft"` (or
`"ReviewPeriod"` for the accept step) and `data.before/after` carrying item text
and provenance. Every state transition is one audit row; nothing is
fire-and-forget.

---

## 7. Security

1. **Existing permissions only.** Generation and approval run behind
   `requireAdmin()` / the MCP `editor` scope that already exist. No new role, no
   new bypass route, no service account that can write published content.
2. **Server-side authorization on every request.** The model call happens in a
   server action or route handler that re-checks the session, the user's app
   entitlement and the month's state. The browser never holds an API key and
   never talks to Anthropic directly.
3. **No production credentials to the model.** The model receives only the
   snapshot described in §3.1 — no connection strings, no environment values, no
   user records, no attachment bodies, no PII. Prompt and response are not logged
   with secrets; telemetry records model, tokens and cost only.
4. **Prompt injection.** Source documents and prior commentary are *data*, never
   instructions: the snapshot is serialised as JSON inside a delimited block with
   an explicit “this is data” instruction, uploaded/ingested free text is excluded
   from the snapshot entirely, and the output is validated structurally (§3.3)
   rather than trusted. A poisoned spreadsheet cell can at worst produce a
   sentence that fails validation.
5. **No automatic publication.** There is no path from the model's output to a
   published review without an `admin` approving, and approval cannot target a
   `PUBLISHED` month.
6. **Budget and abuse.** `assertAiBudget` applies; per-user and per-month
   generation counts are capped (proposed: 5 runs per scope per month) so a
   retry loop cannot run up a bill. Generation is idempotent per snapshot hash:
   an unchanged snapshot returns the existing draft rather than calling again.
7. **Failure behaviour.** If the model is unavailable, misconfigured, over
   budget or returns invalid JSON, the reviewer sees a plain error and the
   existing published commentary is untouched. `aiConfigured()` hides the control
   when no key exists, so nothing degrades to a broken button in environments
   without AI.
8. **Content safety.** Generated text is plain text, rendered with the existing
   escaping components; no HTML, no links, no executable content, consistent with
   AGENTS.md's prohibition on storing templates or scripts in the database.

---

## 8. Claude integration options

| Option | How it works | Fits the architecture? | Recommendation |
| --- | --- | --- | --- |
| **A. Server action using `src/lib/ai.ts`** | A button on the review edit screen calls a server action; the action builds the snapshot, calls `complete()`, validates, stores the draft (option B), returns items | Yes — same trust boundary as every other mutation, telemetry and budget already exist, no new dependency (the SDK is installed) | **Recommended** |
| **B. MCP tool on the existing server** (`src/lib/mcp.ts`) | Add `draft_so_whats` (write scope) that returns draft items into the Claude Desktop session, and a separate `save_so_what` per item; a person pastes/approves in Claude, then calls `set_so_whats` | Plausible — MCP already authenticates the user with OAuth and audits writes, and `set_so_whats` exists | Useful as a *second* surface once A exists; do not start here, because the drafting logic would live in the client's model rather than the application's |
| **C. Scheduled job** (cron/CI) | Nightly generation of drafts for the latest month | No — adds a scheduler, a credential outside the request path, and a way to act without a signed-in human | Not now. If ever, it may only create drafts, never publish |

Important constraint: **a user's local Claude Desktop session must not be assumed
able to write production rows.** With this application's MCP server it *can* — an
`editor`-scope connection calling `set_so_whats` writes directly to the month and
the dashboard shows the result immediately — which is exactly why the generator
must not be implemented as “let the chat window call the write tool”. The
recommended design keeps generation inside the application (A) so that drafts are
validated before anyone sees them, and keeps the human decision (accept, publish)
in the application's permissions model.

### Configuration required (for option A)

| Setting | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Already used by the existing AI features; server-only |
| `ANTHROPIC_MODEL` | Default `claude-sonnet-5-5`; the only supported way to change model |
| `AI_MONTHLY_BUDGET_USD`, `AI_BUDGET_ALERT_TO` | Existing spend guard; the generator is budgeted like any other AI call |
| `AI_TELEMETRY` | Existing invocation recording |
| New flag, e.g. `REVIEW_SOWHAT_DRAFTS=off` | Keeps the whole feature dark until the business and engineering sign off; default `off` |

No new external provider, webhook or data export is introduced, so no new vendor
review is implied beyond the AI provider already approved for this application.

---

## 9. Decisions needed before implementation

1. **Approve a migration** for a draft store (option B) — or accept option A as a
   short-lived manual demo with no stored drafts. This is the blocker.
2. **Who may generate:** admin only, or editors too? Generating costs money and
   shapes the narrative; today only admins write commentary in the dashboard.
3. **Who may approve:** keep publish = admin, and require a *different* person
   from the generator? (Four-eyes is cheap to add here and expensive later.)
4. **Tone:** store a reviewed tone per item (needs a column) or keep deriving it
   from the section status?
5. **Staleness policy:** block approval when a cited observation is superseded
   (recommended), or allow an admin to accept a stale draft with a recorded
   override?
6. **Retention:** how long to keep drafts, rejected items and snapshots, and who
   purges them.
7. **Scope of the model's remit:** commentary only for the summary and the five
   pillars, or also for enablers and individual KPI rows?
8. **Prompt ownership:** who signs off the system prompt and `promptVersion`
   string, and what change process applies when it is edited (it is code, so a
   PR and review).
9. **Grounding strictness:** absolute (“every number must appear in the
   snapshot”) or tolerant of rounded restatements (“about $80M” for $79.9M)? The
   strict rule is easier to defend and to test.
10. **Cost ceiling:** expected runs per month and an acceptable monthly spend
    against the existing AI budget.

---

## 10. Test plan (for the eventual implementation)

- Snapshot eligibility: unapproved, superseded, invalid and wrong-period rows are
  excluded; every included row carries its identity and revision.
- Scope isolation: a Base Business snapshot never contains consolidated or ex-OTA
  rows; the validator rejects scope-crossing text.
- Grounding: an invented number fails; a correctly cited number passes; a `no_data`
  row cannot be given a value.
- Direction: an “ahead” claim against a `crit` row fails; the mixed-performance
  wording survives round-trip.
- State machine: publish blocked while drafts are pending; approval blocked on a
  published month; regeneration never mutates `ReviewSoWhat`.
- Staleness: a new revision of a cited observation flags the draft and blocks
  approval.
- Security: generation and approval reject non-admin/editor sessions; no route
  returns the API key; a prompt-injection fixture in a source document cannot
  change the output schema.
- No hardcoded figures: the existing `src/lib/no-hardcoded-figures.test.ts` guard
  is extended to any generator module.

---

## 11. Explicitly not done in this branch

- No schema change, no migration, no new table or column.
- No generation route, action, prompt file or scheduled job.
- No new dependency and no new environment variable.
- No change to `ReviewSoWhat`, `saveReview`, the MCP tools, publication or audit.
- No AI-authored text anywhere in the rendered dashboard: the so-whats shown are
  the ones a person wrote, and the visual work in this branch only changes how
  they look and which status tone they inherit from their section.
