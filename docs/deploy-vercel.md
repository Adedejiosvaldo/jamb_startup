# Deploying to Vercel (one project, two services)

The repo deploys as **one Vercel project** using [Vercel Services](https://vercel.com/docs/services), configured in
the root `vercel.json`:

| Service | Root       | Framework                    | Public path               |
| ------- | ---------- | ---------------------------- | ------------------------- |
| `web`   | `apps/web` | Next.js                      | everything else (`/(.*)`) |
| `api`   | `apps/api` | NestJS (entry `src/main.ts`) | `/api/*`                  |

One domain serves both, e.g. `https://scorecoach.vercel.app` (web) and `https://scorecoach.vercel.app/api/health`
(API). The browser calls the API same-origin at `/api`, so no CORS setup is needed.

There are **no service bindings**: the web app calls the API only from the browser (client components through
`apps/web/src/lib/api.ts`), never from its own server, and the API never calls the web app. If server-side rendering
ever calls the API, add a binding on `web` (`{ "type": "service", "service": "api", "format": "url", "env": "API_URL" }`)
and use `process.env.API_URL` in that server code.

The API accepts its routes with or without the `/api` prefix (`apps/api/src/configure-app.ts`), so it works whether
Vercel forwards the prefix or strips it, and locally on `http://localhost:4000/api/...`.

## 1. Create the project

New Project → import `Adedejiosvaldo/jamb_startup` → leave Root Directory at the repo root. Vercel reads
`vercel.json` and builds both services.

## 2. Database (Neon)

1. **Storage → Create → Neon (Postgres)**, region Europe (Frankfurt/London) — closest to Lagos. Connect it to the project.
   Vercel adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.
2. Add `DIRECT_URL` = the value of `DATABASE_URL_UNPOOLED`.
3. Apply migrations from your laptop (and after every schema change):
   `cd apps/api && DATABASE_URL=… DIRECT_URL=… pnpm db:deploy`

## 3. Environment variables (shared by both services)

| Name                                               | Staging value                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `APP_ENV`                                          | `staging`                                                                                     |
| `JWT_ACCESS_SECRET`                                | 48+ random chars (`openssl rand -base64 48`)                                                  |
| `OTP_HASH_SECRET`                                  | another 48+ random chars                                                                      |
| `SMS_PROVIDER`                                     | `console` until Termii is ready, then `termii` + `TERMII_API_KEY`, `TERMII_SENDER_ID`         |
| `DEV_FIXED_OTP`                                    | e.g. `246810` — staging only, so testers sign in without SMS. Remove once Termii works.       |
| `PAYMENT_PROVIDER`                                 | `fake` until Paystack is ready, then `paystack` + `PAYSTACK_SECRET_KEY` (test key on staging) |
| `SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SUPPORT_WHATSAPP` | your support number, e.g. `2348012345678`                                                     |

Not needed on Vercel: `NEXT_PUBLIC_API_URL` (defaults to `/api`), `WEB_URL` (defaults to the project's production
domain; set it once you add a custom domain), `CORS_ORIGINS` (same origin).

Production: `APP_ENV=production` refuses console SMS, fake payments and `DEV_FIXED_OTP`.

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

Webhook URL: `https://<your-domain>/api/v1/webhooks/paystack`. Test keys on staging, live keys only on production.

## Local

- `pnpm dev` — API on :4000, web on :3000 (`NEXT_PUBLIC_API_URL=http://localhost:4000/api` in `apps/web/.env.local`).
- `vercel dev` — runs both services behind the same routing as production; leave `NEXT_PUBLIC_API_URL` unset.
