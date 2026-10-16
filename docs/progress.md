# Build progress

Tracks spec §25. Update this file in the same PR as the work.

## Built — the spec §25 "MVP definition" plus most of P1

**Platform**

- pnpm monorepo, NestJS 11 API + Prisma 6 / Postgres 16, Next.js 15 PWA (Tailwind 4, Base UI primitives, lucide icons)
- CI: format, lint, typecheck, migration-drift check, API unit + e2e tests, build
- Schema: every table in §9 plus `refresh_tokens`, `school_event_entries`, staff TOTP, parent report tokens, pay-link tokens
- Service worker: app shell, CBT and results open offline; content-hashed assets cached
- Audit log on every staff write; staff routes require role **and** TOTP 2FA (§14)
- Design system in `DESIGN.md`; UI skills `baseline-ui` + `fixing-accessibility` (ibelick/ui-skills) installed for agents

**Student (web)**

- F-ACQ-01 subject-combination checker (no account) · F-ACQ-04 landing (no fake claims, live price, FAQ)
- F-ACC-01 phone + OTP, F-ACC-02 two-device limit with picker, F-ACC-03 5-step onboarding (prefilled from checker, subject warnings), F-ACC-04 parent opt-in link, F-ACC-05 deletion request
- F-DIAG-01/02/03 full + quick diagnostic, predicted range report with honest early-estimate labelling
- F-CBT-01 CBT replica: subject tabs, navigator grid, timer + auto-submit, flag, A–D/N/P/S keys, calculator, full screen; answers autosave locally and sync (offline-safe)
- F-PRAC-01 Today plan · F-PRAC-02 topic practice with instant feedback · F-PRAC-03 free 20/day · F-PRAC-04 right + wrong-option explanations (paid) · F-PRAC-05 spaced-repetition mistake review
- F-CBT-03 speed drills · F-CBT-06 weekly mini-mock · full mocks · F-PROG-01/02/05 trend chart, streaks, countdown, mastery map
- F-BILL paywall: Paystack checkout, coupons, F-PAR-01 "ask my parent to pay" WhatsApp link, server-verified unlock
- F-SUP-02 report a problem (context attached) · F-SUP-03 report a question · F-SUP-05 help centre incl. exam-day kit + registration checklist · privacy, terms
- F-JRN-01 verified updates feed on Today

**Parent (web, no login)** — opt-in page, weekly report page with trend (F-PAR-04), pay-link checkout + confirmation

**Teacher (web)** — F-TCH-01 apply/verify, F-TCH-02 class codes + join link, F-TCH-03 class overview (inactive, weakest topics, predicted distribution; first name + initial only), F-TCH-05 earnings

**Staff console (/admin)**

- Dashboard (§16/§27 funnel, revenue, refunds, WAU, paid students)
- Questions: list/filter/search, create/edit (new version → re-review), second-person review, publish (bulk), retire, CSV/JSON bulk import with all-or-nothing validation, history
- Question reports queue (confirm → pull question + 7 days reward)
- Users: search, full profile, devices (sign out), goodwill days, guarantee eligibility calculator, orders reconcile/refund
- Orders (paid-not-unlocked runbook: Reconcile), coupons, teachers verify + commissions payout
- Support inbox with priority order and 12-hour SLA tracking; WhatsApp outbox (manual send); Sunday parent-report run
- Schools: mock-day paper generation, printable paper + answer key, fast keyboard answer entry, printable class readiness report (F-SCH-02) and individual reports (F-SCH-03)
- Course requirements editor (source + checked date mandatory), topics weights/learnability, exam config, announcements

**Engine** — prediction v1 (§6.2/§6.4: topic-weighted, recency ×2, difficulty-weighted, speed penalty, ranges ±k/√n with floor/ceiling, 30-answer rule with an honest "early" tier), rule-based daily plan (§7), SR intervals 1/3/7/14, all versioned (`ENGINE_VERSION`)

## Not built / needs you

**Decisions** ([DECIDE])

1. Hosting for staging/production (§12.2) — nothing is deployed yet.
2. Product name + domain (code uses "ScoreCoach", `scorecoach.ng`, `pay.scorecoach.ng`).
3. Price (seed uses ₦12,000), early-bird coupon, teacher commission (default 20%) and student discount (default 10%).
4. MVP subject list; whether under-18 sign-up needs parental consent (§14).
5. Short-diagnostic vs the "30 answers per subject" rule: implemented as an _early estimate_ (±25 floor) below 30. Confirm.

**Content (the real bottleneck)** — `db:seed:demo` is placeholder only. Needed before launch: real syllabus topics + weights from tagged past papers, 300+ reviewed questions per subject with explanations, course requirements from the current JAMB brochure for 20 universities × 30 courses, 2027 exam dates/fees/novel.

**Accounts / verification** — Termii (sender ID, DND delivery per network), Paystack business verification + webhook URL, WhatsApp Business number, legal review of privacy/terms/refunds and use of past questions, NDPA.

**Engineering still open**

- Deploy + staging, Sentry, structured logs, uptime checks, backups (§12)
- WhatsApp Cloud API automation (templates, inactivity alerts, key dates) — manual outbox works today
- Offline content packs + delta updates (§13.1–2); today a started test works offline, starting a new one needs network
- Refresh token in httpOnly cookie (currently localStorage) once web and API share a domain
- E2E browser tests in CI (Playwright), load test to 1,000 concurrent (§12.7)
- P2: IRT engine, admission navigator, post-UTME, OMR scanning, leaderboards, Pidgin/TTS, AI tutor, Play Store TWA
