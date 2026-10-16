# ScoreCoach

JAMB UTME preparation that predicts a student's score, tells them what to study to reach their course's
requirement, and keeps parents in the loop. The full product spec is in
[`docs/build-spec.md`](docs/build-spec.md); feature IDs such as `F-ACC-01` refer to it.

## Layout

```
apps/
  api/   NestJS modular monolith + Prisma (PostgreSQL)   → http://localhost:4000
  web/   Next.js PWA (student + parent web app)          → http://localhost:3000
docs/    spec and engineering notes
```

## Getting started

Requirements: Node 22+, pnpm 10 (`corepack enable`), Docker (or a local PostgreSQL 16).

```bash
pnpm install
docker compose up -d                       # postgres + redis
cp apps/api/.env.example apps/api/.env     # dev defaults work as-is
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @scorecoach/api db:deploy    # apply migrations
pnpm --filter @scorecoach/api db:seed      # subjects + exam_config
pnpm dev                                   # api + web with hot reload
```

Open http://localhost:3000/login. With `SMS_PROVIDER=console` the OTP is printed in the API log
(`Your ScoreCoach code is 123456`). The console provider is refused outside development/test.

## Common tasks

| Task                    | Command                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| All checks (as CI runs) | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`                                       |
| API tests               | `pnpm --filter @scorecoach/api test` (needs Postgres; uses `scorecoach_test`)                         |
| New DB migration        | edit `apps/api/prisma/schema.prisma`, then `pnpm --filter @scorecoach/api db:migrate --name <change>` |
| Format                  | `pnpm format`                                                                                         |

The e2e tests default to `postgresql://postgres:postgres@localhost:5432/scorecoach_test`; create it once with
`createdb scorecoach_test` (or `docker compose exec postgres createdb -U postgres scorecoach_test`) and run
`DATABASE_URL=… pnpm --filter @scorecoach/api db:deploy` against it. Tests truncate every table in that database.

## API so far

| Method & path                   | Notes                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| `GET /health`                   | DB check, for uptime monitors and deploy gates                           |
| `POST /v1/auth/otp/request`     | `{phone}` · 60s resend cooldown · 5 codes/hour/number                    |
| `POST /v1/auth/otp/verify`      | `{phone, code, device}` → tokens (200) or device picker (409)            |
| `POST /v1/auth/devices/replace` | `{pendingToken, revokeDeviceId}` → finish sign-in on a 3rd device        |
| `POST /v1/auth/refresh`         | `{refreshToken}` → rotated pair; reuse of an old token revokes the chain |
| `POST /v1/auth/logout`          | revokes the current device                                               |
| `GET /v1/me`                    | current user                                                             |
| `GET /v1/me/devices`            | active devices (max 2)                                                   |
| `DELETE /v1/me/devices/:id`     | sign out another device; takes effect immediately                        |

Errors are `{ code, message, ...extra }` with stable `code` values (`OTP_INVALID`, `OTP_COOLDOWN`, …) that the
web app maps to user-facing copy.

Not affiliated with JAMB.
