<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Awayday Strategic Initiatives — agent development standards

These rules supplement the existing Next.js-generated guidance above. They
apply to Claude Code and other coding agents. This application is
engineering-owned; it is not automatically authorized for unattended
citizen-developer source-code releases.

## 1. Security boundaries — engineering-owned

Never change or bypass Entra SSO, Better Auth, MFA, sessions, user provisioning,
roles/app entitlements, token validation, CSRF protection, secrets, rate limits,
audit enforcement or database security without engineering approval. Relevant
paths include src/lib/auth.ts, sso.ts, session.ts, roles.ts, api-tokens.ts,
mfa-policy.ts, audit.ts, dev-auth.ts, and related API route guards. This is a
security-effect rule, not just a filename list.

Cloudflare Workers configuration, Hyperdrive/Neon connections, R2 storage,
deployment workflows, CI, .github/**, production credentials, Prisma schema,
migrations, import/seed scripts and infrastructure remain engineering-controlled.
Do not bypass an existing guard by implementing a parallel unprotected route.

### KPI ingestion through the existing MCP is intentionally permitted

**Do not block legitimate KPI ingestion, KPI value updates or permitted KPI
definition-management actions through the existing authenticated MCP/chatbot
workflow.** The user must be able to ingest and maintain KPI information using
the application's approved tools, subject to their actual authenticated
permissions and the tool's existing authorization rules.

- Use existing approved MCP tools and application APIs, not direct production
  SQL or a cloud CLI. Read the current KPI identity and state before writes.
- Preserve metric keys, source provenance, reporting period, entity/reporting
  scope, time/comparison basis, revision identity and audit history.
- Respect publication/approval locks, supersession and all server-enforced
  invariants; never silently overwrite published history or fabricate numbers.
- For consequential/bulk writes, preview exact changes and obtain explicit
  user confirmation; report recorded results and any rejected entries.
- Changes **to the code implementing** KPI calculation formulas, ingestion
  authorization, definition-schema constraints, audit rules, publication
  policy or MCP permission checks require engineering review. Ordinary data
  writes through already-approved tools do **not** become engineering-only
  merely because they concern KPI definitions or values.
- Never assume an MCP capability exists solely because instructions mention
  it; inspect actual available tools and do not exceed their authority.

## 2. Architecture and data rules

- Never hardcode business-managed data (KPI observations, company data,
  unit/shop lists, configurable options, financial figures or other operational
  records). Obtain it from the approved source of truth. Genuine technical
  constants, fixed enums and static UI defaults may remain in source code.
- **Never introduce storage of HTML, page/email/PDF templates, JavaScript,
  executable scripts or application source in database fields.** Keep
  templates and executable logic in reviewed version-controlled source;
  store validated structured data or plain text instead. Use safe,
  non-executable formats for any approved rich text.
- Never execute database content as code, use eval/new Function, inject unsafe
  raw HTML, or interpolate untrusted SQL. Use established Prisma services,
  parameterized queries, server-side validation and authorization.
- Reuse existing components, data models, integrations and calculations.
  Do not create duplicate sources of truth or rewrite unrelated modules.
- Preserve tenant/entity scoping, sensitive-data handling, KPI data lineage,
  revision semantics, business approvals and auditability.
- Do not insert test records into production, silently bulk-edit/delete data,
  export PII to local tools/prompts, or change schema during startup/deploy.
- Avoid unbounded queries, N+1 reads and unbounded write batches. Never leak
  credentials, tokens or private financial/PII payloads in logs and errors.
- Adding dependencies, external AI providers, webhooks, cron jobs or new data
  exports requires engineering review. Never weaken a test or security
  restriction to make a change appear successful.

Legacy violations should be documented for remediation, not copied forward.

## 3. Code workflow for authorized changes

1. Read AGENTS.md, CLAUDE.md and relevant project docs. Review git status,
   preserve work in progress, and fetch latest origin/master.
2. Create a dedicated feature branch from current master. Never push source
   changes directly to master, force-push or discard another person's work.
3. Implement the smallest requested, permitted change with appropriate
   regression/security tests and documentation.
4. Run npm run typecheck, npm run lint, npm test and npm run build where
   possible. Self-review the diff for bugs, missing permissions, injection,
   PII exposure, unintended files and regressions. State unrun tests clearly.
5. Push the branch and open a PR. Wait for independent GitHub CI and any
   required reviews. Automatic merging of an ordinary change is allowed only
   when engineering has explicitly enabled unattended merging in this repo,
   independently enforced checks pass, no protected code is changed, and
   GitHub allows merge without bypass. Otherwise leave the PR for engineering.
6. Never deploy, change Cloudflare/Neon/R2 settings or run production migrations
   without explicit approval. Verify the real released commit and health
   before saying a change is live.

For **business-data updates**, use the approved authenticated MCP tools with
their normal user authorization and audit trail. Such updates do not need a
GitHub PR, but they must not be used to change code/schema/security controls.

## 4. Required documentation and handoff

Maintain README.md, ARCHITECTURE.md, AGENTS.md, SETUP.md, DEPLOYMENT.md,
STATUS.md, RUNBOOK.md, .env.example and architecture decision records (ADRs).
If a file is missing, report the gap and create an accurate proposed document
within the authorized PR; do not invent infrastructure or ownership facts.

Document the business purpose, architecture, infrastructure, environments,
integrations, security/data boundaries, operational ownership, development
setup, deployment/rollback steps, open issues and next steps. Update affected
documentation when significant changes occur; refresh STATUS.md at project
milestones and handoff with verified progress, blockers, PR/release state and
next actions. Significant architectural decisions need reviewed ADRs.
Never include credentials or private data in documentation.

Explain work in plain English to nontechnical users: what changed, which tests
ran, PR link if it was a code change, and whether it is awaiting review,
merged or independently confirmed as deployed.
