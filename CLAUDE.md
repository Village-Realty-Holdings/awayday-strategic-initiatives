@AGENTS.md

# Claude Code — Awayday Strategic Initiatives

Read the imported AGENTS.md and relevant project documentation before work.
Preserve the Next.js-generated agent guidance.

Use the existing authenticated MCP/chatbot tools for legitimate KPI ingestion,
KPI value updates, and permitted KPI definition management. These business-data
actions are allowed within the signed-in user's authorization; do not route
them through GitHub PRs or require engineering merely because they touch KPIs.
Preserve approval, publication, reporting-scope, revision and audit rules.
Never use raw SQL, AWS/Neon credentials or unauthorized shortcuts.

For source-code changes, create a feature branch, test, self-review, open a PR,
and obey engineering-owned security boundaries and independent GitHub checks.
Do not auto-merge unless this repo is expressly authorized for unattended
merging. Never modify Entra, auth/session/access controls, schema, infrastructure
or release configuration under ordinary business-user authority.

Never hardcode business data or put HTML/scripts/templates in the database.
Maintain the required docs, especially STATUS.md at milestones and handoff.
Do not claim a merged PR has reached production without deployment evidence.
