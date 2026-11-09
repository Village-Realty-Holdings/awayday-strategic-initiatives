# Status

_Last updated 2026-11-09, on branch `feat/mcp-oauth-entra`._

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
