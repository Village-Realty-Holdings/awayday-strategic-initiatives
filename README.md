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
| local | `npm run dev` | any | none: local Postgres (`compose.yaml`) | local, in-memory |

Hyperdrive configs (Cloudflare account in `wrangler.jsonc`): `live-awayday-strategic-initiatives` → Neon `production`, `dev-awayday-strategic-initiatives` → Neon `development`. Both use the direct (non-pooler) host with caching disabled. The Neon `production` branch is protected.

Bindings and non-secret vars live in `wrangler.jsonc` (top level = production, `env.development`). After editing it, run `npm run cf-typegen`.

## Local development

```bash
npm install            # also runs `prisma generate` (Worker client + Node client)
docker compose up -d   # Postgres 18 on localhost:5432
```

Local development uses its own Postgres, not a Neon branch. Create `.env.local` (gitignored):

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

The standalone app includes the original password login, TOTP enrollment and verification, Microsoft Entra SSO, email sign-in links with a scanner-safe confirmation page, password changes, sign-out, and role/app-access guards. Successful sign-in links default to `/apps`, not the original Talent module. Magic links are restricted to existing users; Talent employee and reviewer provisioning is not part of this app.

Fill the placeholders in `.env` for local development. `.env.example` documents the same variables without secrets. If `.env.local` exists, its values take precedence. Restart the dev server after changing them.

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

For Microsoft sign-in, the Entra web redirect URI is `<BETTER_AUTH_URL>/api/auth/callback/microsoft`, including `http://localhost:3000/api/auth/callback/microsoft` for local testing. Registering redirect URIs, creating credentials, verifying a Resend domain, and configuring Worker secrets/vars are external settings changes requiring approval. Local `.env` values are not automatically deployed to Workers. The deployed origins in `wrangler.jsonc` still contain `REPLACE_WITH_SUBDOMAIN` and must be confirmed before deployment.

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

To create a migration: edit the schema, then `npx prisma migrate dev --name <change>` against local Postgres. Apply it to the Neon `development` branch, then `production`, with `migrate deploy`.

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
