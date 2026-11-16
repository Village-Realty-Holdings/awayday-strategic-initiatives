# Status

_Last updated 2026-11-16, on branch `fix/auth-per-request`._

## Incident 2026-11-16: production returns 500 on signed-in pages

**Symptom.** Inbox, then the overview, returned "Something went wrong" (500) for a signed-in admin. The Worker log showed: "This promise was created by a request that has since ended, so it can never settle", thrown inside Better Auth's API wrapper while it awaited its setup promise.

**Cause.** `auth` (src/lib/auth.ts) was built once at module load, so Better Auth's setup promise belonged to whichever request first loaded the module. If that request ended before setup finished, every later request in the isolate waited on a promise Workers will never settle, and failed until the isolate was recycled. This most likely became visible after the OAuth/MCP release (#18) added plugins with more setup work, but that link hasn't been confirmed.

**Fix (branch `fix/auth-per-request`, PR open, not merged or deployed).** The Better Auth instance is built per request, keyed on the Worker `ExecutionContext` (the same scoping as the Prisma client). `auth` stays a proxy, so call sites are unchanged. Regression test: `src/lib/auth-per-request.test.ts`. typecheck, lint, all 504 unit tests and the Worker build pass. This was not reproduced or verified on a running Worker; confirm on the deployed app after release.

## Current milestone: connect Claude with OAuth and Entra sign-in

**What changed (branch, not merged).** `/api/mcp` now authenticates with OAuth instead of personal API tokens. The app acts as its own authorization server, and people sign in with Microsoft Entra and approve Claude. See [ADR 0001](docs/adr/0001-mcp-oauth-with-entra.md). Settings → API tokens is replaced by Settings → Connected apps, and admins get Admin → Connected apps for everyone's connections. Signing out disconnects Claude. The old API-token table stays in place, unused, until a follow-up release drops it.

**Verified locally:**
- typecheck, lint, all unit tests, and `next build` pass.
- The Cloudflare Worker bundle builds (`opennextjs-cloudflare build`).
- An end-to-end OAuth check passed 19 of 19 against both `next dev` and the local Workers preview. With sign-out and audit checks added, it passed 24 of 24 against `next dev`. Microsoft sign-in itself was simulated with a database session, because it can't be run headless here.

**Not yet verified:**
- A real Microsoft sign-in through the flow.
- A real claude.ai connector against a deployed environment.
- Anything in production. This change is not deployed.

## Before release (engineering)

1. Review the PR. It touches auth, adds a migration and adds dependencies, so it needs engineering review under AGENTS.md.
2. Apply migration `20261109180000_mcp_oauth` (additive only) before deploying the code. The previous release keeps working against the migrated database, so it can be redeployed as a rollback.
3. Confirm Entra SSO is enabled on the target environment (`MICROSOFT_*` set). Without it, Claude can't be connected.
4. Tell current API-token users that tokens stop working and they need to reconnect through **Connect** in Claude.

## Open follow-ups

- Drop the retired `ApiToken` table (destructive migration), in a release after the OAuth flow is confirmed in production.
- Pruning of stale dynamically registered OAuth clients.

## Documentation gaps

AGENTS.md lists ARCHITECTURE.md, SETUP.md, DEPLOYMENT.md and RUNBOOK.md, but none of them exist yet. README.md covers setup, deployment and MCP for now. Writing them needs facts about infrastructure ownership that aren't recorded in the repo.
