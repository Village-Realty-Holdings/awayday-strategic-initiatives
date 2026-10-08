# Awayday Strategic Initiatives

The strategic-initiatives tracker and CIM risk register, extracted from `awayday-platform` into its own app.

Next.js 16 on **Cloudflare Workers** (via [OpenNext](https://opennext.js.org/cloudflare)), **Neon Postgres** through **Hyperdrive**, files in **R2**, auth by **Better Auth** (invite-only email/password + TOTP MFA, magic link via Resend).

```
GitHub → Workers Builds → Worker (Next.js) ─┬─ HYPERDRIVE → Neon (production / development branch)
                                            └─ ATTACHMENTS → R2 (si-attachments-prod / -development)
```

## Environments

| | Worker | Git branch | Neon branch | R2 bucket |
| --- | --- | --- | --- | --- |
| production | `awayday-strategic-initiatives` | `master` | `production` | `si-attachments-prod` |
| development | `awayday-strategic-initiatives-development` | `development` | `development` | `si-attachments-development` |

Bindings and non-secret vars live in `wrangler.jsonc` (top level = production, `env.development`). After editing it, run `npm run cf-typegen`.

## Local development

```bash
npm install            # also runs `prisma generate` (Worker client + Node client)
```

Create `.env.local` (gitignored):

```bash
# Neon development branch, DIRECT (non-pooler) host
DIRECT_URL=postgresql://…
# What the HYPERDRIVE binding connects to locally
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgresql://…
BETTER_AUTH_SECRET=…            # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
# Optional
RESEND_API_KEY=…
ANTHROPIC_API_KEY=…
DEV_AUTH_AS=you@awayday.com     # skip sign-in locally (never set on a deployment)
```

- `npm run dev`: Next dev server on :3000 with Cloudflare bindings emulated (R2 is local and in-memory).
- `npm run preview`: builds the real Worker bundle and serves it in workerd on :8787. Put `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:8787` and `APP_URL` in `.dev.vars`. Export the Hyperdrive variable in the shell.
- `npm test`, `npm run lint`, `npm run typecheck`.

## Database

The schema is in `prisma/schema.prisma`. The baseline migration is `prisma/migrations/0_init`. Two clients are generated:

- `src/generated/prisma`: the Workers runtime client, used by the app. It connects per request through `env.HYPERDRIVE` (`src/lib/prisma.ts`).
- `prisma/generated/node`: the Node client, used by the CLI scripts in `prisma/`.

Migrations are applied **manually**, per Neon branch, against the **direct** URL:

```bash
DIRECT_URL=postgresql://… npm run db:migrate:deploy
DIRECT_URL=postgresql://… npm run db:migrate:status
```

To create a migration: edit the schema, then `DIRECT_URL=<dev branch> npx prisma migrate dev --name <change>`.

### First admin

```bash
DIRECT_URL=postgresql://… ADMIN_EMAIL=you@awayday.com ADMIN_NAME="Your Name" npm run db:seed:admin
```

This prints a temporary password, or you can pass `ADMIN_PASSWORD`. MFA enrolment is forced on first sign-in. Admins invite everyone else from **People & access**.

Break-glass password reset: `DIRECT_URL=… PW_EMAIL=… PW_NEW=… npm run db:set-password`.

## Deploying

Each Worker is connected to this repo in Cloudflare **Workers Builds**:

- Build command: `npm ci && npx opennextjs-cloudflare build`
- Deploy command (production): `npx opennextjs-cloudflare deploy`
- Deploy command (development): `npx opennextjs-cloudflare deploy -- --env development`

Secrets, per environment (add `--env development` for development):

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put AI_BUDGET_ALERT_TO
```

**Order of operations for a release with a schema change:** apply the migration to the Neon branch first, then merge so that Workers Builds deploys.

## Notes

- **Attachments:** files are stored at `attachments/<initiativeId>/<attachmentId>` in R2. They are served only through `/api/attachments/<id>`, which checks the session, always downloads rather than displaying inline, and is audited. The `imports/` prefix is reserved for FY27 imports.
- **Rate limits:** Better Auth's limiter uses the `rateLimit` table, because Workers isolates don't share memory. Client IP comes from `cf-connecting-ip`.
- **Entra SSO:** the code is present but inert until `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID` are set.
