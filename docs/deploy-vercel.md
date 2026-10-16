# Deploying to Vercel

Two Vercel projects from this one repo, plus a Neon Postgres database.

```
scorecoach-web  → apps/web  (Next.js)          e.g. https://scorecoach-web.vercel.app
scorecoach-api  → apps/api  (NestJS, 1 function) e.g. https://scorecoach-api.vercel.app
Neon Postgres   (Vercel Marketplace → Storage → Neon)
```

## 1. Database (Neon)

1. In Vercel: **Storage → Create → Neon (Postgres)**. Region: Europe (Frankfurt/London) — closest to Lagos.
2. Connect it to the **scorecoach-api** project. Vercel adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.
3. Add `DIRECT_URL` = the value of `DATABASE_URL_UNPOOLED` (migrations need the direct connection).

## 2. API project

New Project → import `Adedejiosvaldo/jamb_startup` → **Root Directory: `apps/api`** (keep "Include files outside
the root directory" on). `apps/api/vercel.json` sets the build: generate Prisma client, run migrations, build Nest.

Environment variables (Settings → Environment Variables):

| Name                | Staging value                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `APP_ENV`           | `staging`                                                                                     |
| `JWT_ACCESS_SECRET` | 48+ random chars (`openssl rand -base64 48`)                                                  |
| `OTP_HASH_SECRET`   | another 48+ random chars                                                                      |
| `WEB_URL`           | `https://scorecoach-web.vercel.app` (your web URL)                                            |
| `CORS_ORIGINS`      | same as `WEB_URL`                                                                             |
| `SMS_PROVIDER`      | `console` until Termii is ready, then `termii` + `TERMII_API_KEY`, `TERMII_SENDER_ID`         |
| `DEV_FIXED_OTP`     | e.g. `246810` — staging only, so testers can sign in without SMS. Remove once Termii works.   |
| `PAYMENT_PROVIDER`  | `fake` until Paystack is ready, then `paystack` + `PAYSTACK_SECRET_KEY` (test key on staging) |
| `SUPPORT_WHATSAPP`  | your support number, e.g. `2348012345678`                                                     |

Check `https://<api>/health` → `{"status":"ok","db":"up"}`.

Production: `APP_ENV=production` refuses console SMS, fake payments and `DEV_FIXED_OTP`.

## 3. Web project

New Project → same repo → **Root Directory: `apps/web`**. Environment variables:

| Name                           | Value                                                  |
| ------------------------------ | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`          | your API URL, e.g. `https://scorecoach-api.vercel.app` |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | same number as the API                                 |

`NEXT_PUBLIC_*` values are baked in at build time — redeploy after changing them.

## 4. Seed the database (from your laptop, once)

```bash
cd apps/api
export DATABASE_URL="<Neon pooled URL>" DIRECT_URL="<Neon unpooled URL>"
pnpm db:seed            # subjects, exam config, 250 syllabus topics (safe for production)
pnpm db:seed:content    # 220 original questions as DRAFTS for review
pnpm db:seed:demo       # STAGING ONLY: placeholder questions, demo universities, demo admin 0800 000 0001
pnpm admin:promote 0803xxxxxxx admin   # make yourself admin (sign in once first)
```

Never run `db:seed:demo` on the production database.

## 5. Paystack (when ready)

Dashboard → Settings → API Keys & Webhooks → webhook URL `https://<api>/v1/webhooks/paystack`. Use test keys on
staging, live keys only on production.

## Notes

- The API runs as one serverless function; the first request after idle takes a second or two (cold start).
- Push to `main` → Vercel deploys both projects automatically; pull requests get preview URLs.
