# Build progress

Tracks spec §25 week by week. Update this file in the same PR as the work.

## Week 0 (16–25 Oct 2026) — foundation

Done

- [x] Monorepo (pnpm workspaces): `apps/api` (NestJS 11 + Prisma 6), `apps/web` (Next.js 15 + Tailwind 4)
- [x] CI (GitHub Actions): format, lint, typecheck, migration-drift check, API unit + e2e tests against Postgres, build
- [x] Postgres schema v1: every table in spec §9, plus `refresh_tokens` (needed by §10's rotating device-bound refresh tokens)
- [x] Seed: 11 MVP subjects and 2027 `exam_config` keys (all values marked [VERIFY])
- [x] F-ACC-01 phone + OTP sign-in: Nigerian number normalisation (070/080/081/090/091), 6-digit code, HMAC-hashed at rest,
      5-minute expiry, 60s resend, 5/hour/number, 5 wrong attempts locks the code, only the newest code is valid,
      OTP never written to `message_log`
- [x] Sessions: 15-minute access JWT + 90-day sliding refresh token, rotated on every use, reuse detection revokes the chain
- [x] F-ACC-02 (device half): max 2 active devices; a 3rd sign-in returns a device picker; self-service sign-out of other
      devices takes effect immediately
- [x] SMS provider abstraction: `console` (dev) and `termii` (DND route)
- [x] Web: landing placeholder with "not affiliated with JAMB", mobile-first sign-in flow, PWA manifest

Not done yet (Week 0 items still open)

- [ ] **Staging environment** — needs a hosting decision (spec §12.2 [DECIDE]) and accounts; see below
- [ ] Redis + BullMQ — not needed until async jobs (WhatsApp sends, reports). OTP rate limits use Postgres for now
- [ ] Sentry, structured JSON logging with request ids
- [ ] Termii account, sender ID approval, and delivery test on MTN/Airtel/Glo/9mobile [VERIFY]
- [ ] WhatsApp OTP fallback (P1)

Known follow-ups

- Web stores tokens in `localStorage`. Move the refresh token to an httpOnly cookie once web and API share a parent
  domain (e.g. `app.` and `api.` under the final domain).
- PWA icons and service worker (offline) are not added yet; they land with offline packs (spec §13).

## Decisions needed from the founder

1. **Hosting for staging/production** (spec §12.2). Options: Render / Railway / Fly.io (PaaS, fastest to set up) or a
   VPS. Run a latency test from an MTN connection in Lagos first.
2. **Product name and domain** (spec §3) — "ScoreCoach" is the working name throughout the code.
3. **MVP subject list** (spec §8.1) — seed currently has the 11 subjects listed in the spec.
4. **Parental consent for under-18 sign-up** (spec §14) — sign-up currently needs only the student's phone.
