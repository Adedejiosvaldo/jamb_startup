# ScoreCoach

JAMB UTME preparation that predicts a student's score, tells them what to study to reach their course's
requirement, and keeps parents in the loop. The full product spec is in
[`docs/build-spec.md`](docs/build-spec.md); feature IDs such as `F-ACC-01` refer to it. What's built and
what's left: [`docs/progress.md`](docs/progress.md). UI rules: [`DESIGN.md`](DESIGN.md).

## Layout

```
apps/
  api/   NestJS modular monolith + Prisma (PostgreSQL)   → http://localhost:4000
  web/   Next.js PWA: student app, parent pages, teacher dashboard, staff console → http://localhost:3000
docs/    spec and progress
.claude/skills/  UI skills agents follow (baseline-ui, fixing-accessibility)
```

## Getting started

Requirements: Node 22+, pnpm 10 (`corepack enable`), Docker (or a local PostgreSQL 16).

```bash
pnpm install
docker compose up -d                         # postgres + redis
cp apps/api/.env.example apps/api/.env       # dev defaults work as-is
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @scorecoach/api db:deploy      # apply migrations
pnpm --filter @scorecoach/api db:seed        # subjects + exam_config (safe in every environment)
pnpm --filter @scorecoach/api db:seed:demo   # DEV ONLY: placeholder topics/questions/universities + demo staff
pnpm dev                                     # api + web with hot reload
```

- Sign in at http://localhost:3000/login. With `SMS_PROVIDER=console` the OTP is printed in the API log
  (`Your ScoreCoach code is 123456`).
- With `PAYMENT_PROVIDER=fake`, "Pay now" opens a local page with a **Simulate successful payment** button.
- Staff console: sign in as the demo admin `0800 000 0001` (or promote yourself with
  `pnpm --filter @scorecoach/api admin:promote 0803… admin`), then go to `/admin`. The first visit asks you to
  set up an authenticator app (TOTP 2FA is mandatory for staff).
- The console SMS provider and fake payment provider are refused in staging/production.

## Common tasks

| Task                    | Command                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| All checks (as CI runs) | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`                         |
| API tests               | `pnpm --filter @scorecoach/api test` (needs Postgres; uses `scorecoach_test`)                         |
| New DB migration        | edit `apps/api/prisma/schema.prisma`, then `pnpm --filter @scorecoach/api db:migrate --name <change>` |
| Format                  | `pnpm format`                                                                                         |

The e2e tests default to `postgresql://postgres:postgres@localhost:5432/scorecoach_test`; create it once with
`createdb scorecoach_test` and run `DATABASE_URL=… pnpm --filter @scorecoach/api db:deploy` against it. Tests
truncate every table in that database.

Content workflow (syllabus, writing/reviewing questions, past questions): [`docs/content-guide.md`](docs/content-guide.md).
Deploying to Vercel (one project, `web` + `api` services) + Neon: [`docs/deploy-vercel.md`](docs/deploy-vercel.md).

## Production configuration (API)

| Variable                                                    | Notes                                                                              |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`                                              | Managed Postgres 16                                                                |
| `JWT_ACCESS_SECRET`, `OTP_HASH_SECRET`                      | ≥ 32 random chars each (`openssl rand -base64 48`)                                 |
| `WEB_URL`, `CORS_ORIGINS`                                   | Public web origin(s)                                                               |
| `SMS_PROVIDER=termii`, `TERMII_API_KEY`, `TERMII_SENDER_ID` | OTP + receipts                                                                     |
| `PAYMENT_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`          | Point the Paystack webhook to `POST /api/v1/webhooks/paystack`                     |
| `PAYMENT_EMAIL_DOMAIN`                                      | Paystack needs an email; phone-only payers get `<digits>@this-domain`              |
| `SUPPORT_WHATSAPP`                                          | Shown on receipts and parent reports (also `NEXT_PUBLIC_SUPPORT_WHATSAPP` for web) |

Not affiliated with JAMB.
