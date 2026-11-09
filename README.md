# Awayday Strategic Initiatives

The strategic-initiatives tracker and CIM risk register, extracted from `awayday-platform` into its own app.

Next.js 16 on **Cloudflare Workers** (via [OpenNext](https://opennext.js.org/cloudflare)), **Neon Postgres** through **Hyperdrive**, files in **R2**, auth by **Better Auth** (invite-only email/password + TOTP MFA, magic link via Resend).

```
GitHub (master) → Workers Builds → Worker (Next.js) ─┬─ HYPERDRIVE → Neon (production branch)
                                                     └─ ATTACHMENTS → R2 (live-awayday-strategic-initiatives)
```

## Environments

| | Worker | Git branch | Neon branch | R2 bucket |
| --- | --- | --- | --- | --- |
| production | `awayday-strategic-initiatives` | `master` | `production` | `live-awayday-strategic-initiatives` |
| local | `npm run dev` | any | none: local Postgres (`compose.yaml`) | local, in-memory |

The Hyperdrive config `live-awayday-strategic-initiatives` points at Neon `production` (direct, non-pooler host, caching disabled). The Neon `production` branch is protected.

Bindings and non-secret vars live in `wrangler.jsonc`. After editing it, run `npm run cf-typegen`.

## Local development

```bash
npm install            # also runs `prisma generate` (Worker client + Node client)
docker compose up -d   # Postgres 18 on localhost:5432
```

Local development uses its own Postgres, not a Neon branch. Create `.env` (gitignored), the one development env file for both the app and the `prisma/` scripts:

```bash
DIRECT_URL=postgresql://awayday:password@localhost:5432/awayday_strategic_initiatives
DATABASE_URL=postgresql://awayday:password@localhost:5432/awayday_strategic_initiatives
# What the HYPERDRIVE binding connects to locally
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgresql://awayday:password@localhost:5432/awayday_strategic_initiatives
BETTER_AUTH_SECRET=…            # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000
# Optional
RESEND_API_KEY=…
EMAIL_FROM="Awayday <notifications@your-verified-domain.com>"
MICROSOFT_CLIENT_ID=…
MICROSOFT_CLIENT_SECRET=…
MICROSOFT_TENANT_ID=…
ANTHROPIC_API_KEY=…
DEV_AUTH_AS=you@awayday.com     # skip sign-in locally (never set on a deployment)
```

Only after approving the target database and the changes, run `npm run db:migrate:deploy` and `npm run db:seed:admin` (see below). Both write to the database.

- `npm run dev`: Next dev server on :3000 with Cloudflare bindings emulated (R2 is local and in-memory).
- `npm run preview`: builds the real Worker bundle and serves it in workerd on :8787. Put `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:8787` and `APP_URL` in `.dev.vars`. Export the Hyperdrive variable in the shell.
- `npm test`, `npm run lint`, `npm run typecheck`.

## Login migration from awayday-platform

The standalone app includes the original password login, TOTP enrollment and verification, Microsoft Entra SSO, email sign-in links with a scanner-safe confirmation page, password changes, sign-out, and role/app-access guards. Successful sign-in links (and Microsoft sign-in) default to `/`, this app's Initiatives overview (users without the grant see a no-access page with sign-out), never the original Talent module. Magic links are restricted to existing users; Talent employee and reviewer provisioning is not part of this app.

Fill the placeholders in `.env` for local development. `.env.example` documents the same variables without secrets. Restart the dev server after changing them. Keep `.env` pointed at local Postgres. To run a `prisma/` script or Prisma command against Neon, use `DOTENV_CONFIG_PATH=.env.production.local`, or pass `DIRECT_URL=…` on the command line, which takes priority over any file.

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Required signing/encryption secret. Use a strong, stable secret; replacing it invalidates sessions and may make stored MFA secrets unreadable. |
| `BETTER_AUTH_URL` | This deployment's origin, locally `http://localhost:3000`. |
| `APP_URL` | The same canonical origin, used in emailed confirmation links. |
| `RESEND_API_KEY` | Enables delivery of sign-in links and invitations. Leave blank until ready; password login does not require email delivery. |
| `EMAIL_FROM` | A sender on a domain verified in your Resend account. Blank uses the inherited sender fallback, so set it explicitly before enabling email delivery. |
| `MICROSOFT_CLIENT_ID` | Entra application/client ID. |
| `MICROSOFT_CLIENT_SECRET` | Entra client secret value, not its secret ID. |
| `MICROSOFT_TENANT_ID` | Your organization tenant ID. All three Microsoft values are required; otherwise SSO stays disabled. |
| `DEV_AUTH_AS` | Optional local-only bypass for an already-existing user. Leave unset when testing the actual login flow. |
| `ENABLE_DEV_TESTING` | Set to `true` for the local **Dev testing** button: change your role, act as an SI lead, load or clear test data, publish a month, pretend it's another date. Only works outside a production build and with a local database. |

For Microsoft sign-in, the Entra web redirect URI is `<BETTER_AUTH_URL>/api/auth/callback/microsoft`, including `http://localhost:3000/api/auth/callback/microsoft` for local testing. Registering redirect URIs, creating credentials, verifying a Resend domain, and configuring Worker secrets/vars are external settings changes requiring approval. Local `.env` values are not automatically deployed to Workers. The deployed origin, `https://awayday-strategic-initiatives.tech-dd8.workers.dev`, is set in `wrangler.jsonc`.

The inherited MFA policy requires app TOTP for accounts with a password; passwordless accounts are exempt, and Microsoft-only accounts rely on Entra enforcing MFA. Entra can create a new least-privileged Initiatives user on first sign-in. Test SSO only after approving account creation and confirming the tenant's MFA policy. Password sign-up is disabled.

Copying code does not copy users, passwords, MFA enrollment, sessions, or provider accounts. Importing those records, applying migrations, seeding an admin, resetting credentials, or changing persisted settings requires explicit approval first. Do not point this app at the original shared database merely to test login.

## Database

The schema is in `prisma/schema.prisma`. The baseline migration is `prisma/migrations/0_init`. Two clients are generated:

- `src/generated/prisma`: the Workers runtime client, used by the app. It connects per request through `env.HYPERDRIVE` (`src/lib/prisma.ts`).
- `prisma/generated/node`: the Node client, used by the CLI scripts in `prisma/`.

Migrations are applied **manually**, per Neon branch, against the **direct** URL:

```bash
DIRECT_URL=postgresql://… npm run db:migrate:deploy
DIRECT_URL=postgresql://… npm run db:migrate:status
```

To create a migration: edit the schema, then `npx prisma migrate dev --name <change>` against local Postgres. Apply it to Neon `production` with `migrate deploy`.

### First admin

```bash
DIRECT_URL=postgresql://… ADMIN_EMAIL=you@awayday.com ADMIN_NAME="Your Name" npm run db:seed:admin
```

This prints a temporary password, or you can pass `ADMIN_PASSWORD`. MFA enrolment is forced on first sign-in. Admins invite everyone else from **Admin → People & access** (`/admin/people`).

Break-glass password reset: `DIRECT_URL=… PW_EMAIL=… PW_NEW=… npm run db:set-password`.

## Deploying

The Worker is connected to this repo in Cloudflare **Workers Builds** and deploys from `master`:

- Build command: `npm ci && npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`

Secrets:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put AI_BUDGET_ALERT_TO
```

**Order of operations for a release with a schema change:** apply the migration to the Neon branch first, then merge so that Workers Builds deploys.

## Connecting Claude (MCP)

The app is an MCP server at **`https://awayday-strategic-initiatives.tech-dd8.workers.dev/api/mcp`** (locally `http://localhost:3000/api/mcp`). With it, Claude can read and update a month's Strategy Review and the initiatives themselves. Every change goes through the same code as Edit Mode and the initiative pages, so the same permissions apply, published months stay locked, and every change is in the audit log.

| Tool | Who can use it | What it does |
| --- | --- | --- |
| `list_review_periods` | everyone | Lists review months, with whether each is a draft or published |
| `get_review` | everyone | Returns one month: header, so-whats, pillars (value, target, status) and SIs (status, progress, next steps, open milestones, asks) |
| `update_review_details` | editors, admins | Sets prepared by, meeting date, updates due and data as of |
| `set_so_whats` | editors, admins | Replaces the so-whats for the summary or for one pillar |
| `set_pillar_measure` | editors, admins | Sets a pillar's value for the month and/or its status (Ahead / On track / Behind / calculated) |
| `add_si_update` | editors, admins, the SI's lead | Records an SI's monthly status, progress and next steps |
| `list_initiatives` | everyone | Lists the active plan's SIs (code, pillar, lead, status, % complete), optionally for one pillar |
| `get_initiative` | everyone | Returns one SI in full: charter, progress, milestones, action items, ELT asks, measures with recent values, latest updates, and the item ids the other tools take |
| `create_initiative` | admins | Adds an SI to the active plan |
| `update_initiative` | editors, admins | Edits the charter: name, leads, objective, KPI and target, baseline, EBITDA value, investment cost |
| `update_initiative_progress` | editors, admins | Sets value created and value to create (e.g. "$1.5M") |
| `add_milestone`, `update_milestone`, `remove_milestone` | editors, admins | Manages milestones |
| `set_milestone_done` | editors, admins, the milestone's owner, the SI's lead | Marks a milestone done or reopens it |
| `add_action_item`, `remove_action_item` | editors, admins | Manages actions and dependencies |
| `set_action_item_done` | editors, admins, the item's owner, the SI's lead | Marks an action item done or reopens it |
| `add_elt_ask`, `update_elt_ask`, `remove_elt_ask` | editors, admins | Manages ELT asks and records decisions |
| `add_measure`, `update_measure`, `set_primary_measure`, `remove_measure` | editors, admins, the SI's lead | Manages KPIs and leading measures, and which KPI drives % complete |
| `add_measure_reading`, `remove_measure_reading` | editors, admins, the SI's lead | Logs or removes a measure's value |

Publishing and unpublishing a month, and deleting an initiative, stay in the app. The `remove_*` tools are marked destructive, so Claude apps can ask before running them.

### Before you start

Connecting Claude needs **Microsoft Entra sign-in** on the site (`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID` set). It reuses the app's existing Entra app registration and callback, so nothing new is needed in Entra. Without those settings the sign-in step says Microsoft sign-in isn't set up, and Claude can't connect. Password and sign-in-link sessions can't be used to connect Claude. Why: [ADR 0001](docs/adr/0001-mcp-oauth-with-entra.md).

### 1a. claude.ai, Claude Desktop and the mobile apps (custom connector)

1. In Claude, open **Customize → Connectors**, click **+ Add**, then **Add custom connector**.
2. Name it `Awayday` and paste the server URL: `https://awayday-strategic-initiatives.tech-dd8.workers.dev/api/mcp`. Leave the OAuth client ID and secret empty. Click **Add**.
3. Click **Connect**. Claude opens the app's sign-in page. Sign in with Microsoft, then choose **Allow editing** or **Allow read only**.

**Team and Enterprise plans:** an owner adds the connector once for the organization. Each person then clicks **Connect** and signs in as themselves, so Claude only ever acts as that person, with their role and access. No shared credentials.

### 1b. Claude Code

```bash
claude mcp add --transport http awayday \
  https://awayday-strategic-initiatives.tech-dd8.workers.dev/api/mcp
```

Then run `/mcp` in Claude Code and choose **Authenticate** for `awayday`. Your browser opens the same Microsoft sign-in and approval. Add `--scope user` to make it available in every project.

### What a connection can do

- **Exactly what you can do in the app.** Your role, suspension and app access are checked on every request, so a change applies straight away. Published months stay locked.
- **Read only** connections see only the read tools.
- **Disconnect** in **Settings → Connected apps**. Claude loses access on its next request. Without use, a connection lapses after 30 days.

### Try it

- "What's the status of each pillar in the October 2026 review?"
- "Set the GROW pillar to Ahead for 2026-10 and add a so-what: 'Unit adds beat budget for the third month running'."
- "Add my update for M&A-01 for 2026-10: on track, LOI signed, closing in December."
- "Mark the 'Sign LOI' milestone on M&A-01 done and log owner churn at 13.1% as of today."

### Protocol notes

- **Protocol versions:** MCP `2026-07-28`, which is stateless: `server/discover`, the version in each request's `_meta`, and the `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` headers checked against the body. Older clients that open with `initialize` (2025-03-26 to 2025-11-25) still work.
- **Transport:** Streamable HTTP. Each POST carries one JSON-RPC message and gets a JSON reply. `GET` returns 405, because there is no server-to-client stream.
- **Auth:** OAuth 2.1 with the app as its own authorization server (Better Auth `mcp()` plugin): RFC 9728 protected resource metadata at `/.well-known/oauth-protected-resource/api/mcp`, RFC 8414 metadata at `/.well-known/oauth-authorization-server/api/auth`, open dynamic client registration (RFC 7591), PKCE, and resource-bound (RFC 8707) 15-minute JWT access tokens with rotating 30-day refresh tokens. Authorization codes go only to Claude's callbacks (`https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`, and loopback `/callback` for Claude Code and Desktop). Personal API tokens (`asi_…`) are no longer accepted.
- **Errors:** a missing or bad token gets a 401 with a `WWW-Authenticate` header pointing at the resource metadata. Each connection is limited to 120 requests a minute. Requests with an `Origin` header from another site are refused.
- **Why not the official SDK:** `@modelcontextprotocol/sdk` isn't used, because its Ajv validator compiles code at runtime, which Workers forbid. See `src/lib/mcp.ts`.

## Notes

- **Attachments:** files are stored at `attachments/<initiativeId>/<attachmentId>` in R2. They are served only through `/api/attachments/<id>`, which checks the session, always downloads rather than displaying inline, and is audited. The `imports/` prefix is reserved for FY27 imports.
- **Rate limits:** Better Auth's limiter uses the `rateLimit` table, because Workers isolates don't share memory. Client IP comes from `cf-connecting-ip`.
- **Entra SSO:** the code is present but inert until `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID` are set.

## FY27 strategic plan

The FY27 refresh uses an explicit `PlanVersion` (`FY27`) and `StrategicArea` records rather than replacing or deleting the legacy FY26 initiatives. The repeatable import manifest is derived from the supplied September 2026 refresh deck and currently defines 31 stable `FY27-SI-###` initiatives across the five value drivers and five enablers.

Administrators can switch the active plan from **Admin → Plan versions**. The switch is transactional: it deactivates the current plan, activates the selected version, writes an audit record, and refreshes the Strategy Review and the Initiatives list. The review works for any plan version: a plan without strategic areas (FY26) is grouped by its initiatives' CIM driver. It does not delete or modify initiatives belonging to the inactive plan.

After applying the migration to the intended database branch, run:

```bash
DIRECT_URL=postgresql://… npm run db:import:fy27
```

The import is safe to rerun: it deactivates prior plan versions, assigns unversioned legacy records to an archived FY26 version, upserts FY27 areas and initiatives, removes obsolete source-managed FY27 rows and their imported child records, and records an `ImportRun` summary. Each SI's charter comes from `src/lib/fy27-charters.json`, transcribed from the deck's one-page charters: objective, value (metric, baseline, target, EBITDA value, investment cost), sponsor and lead. Each run replaces an SI's risks, dependencies and milestones with the deck's, keeping completion by title, and sets the status only where the slide marks one. Monthly updates are never touched. Slide notes and unmarked statuses are listed in the `ImportRun` warnings.

The KPI service (`src/lib/kpi.ts`) resolves active manual overrides before the latest automated observation and otherwise returns an explicit unavailable/stale state. Snowflake and Finance SharePoint workbook refresh jobs still require source identifiers, credentials, permissions, and query/workbook mappings; no production integration is claimed until those external prerequisites are configured and tested.

Initiative-owner notifications are intentionally a follow-on phase after the FY27 dashboard, import workflow, and KPI foundation.
