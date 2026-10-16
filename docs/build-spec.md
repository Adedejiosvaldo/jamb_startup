# JAMB Score Coach — Complete Build Specification

*Version 1.0 · 16 October 2026 · Owner: Joseph Adewunmi*
*Companion to `jamb-venture-brief-for-review.md` (the business case). This document is the "how": every feature, screen, data table, integration, content pipeline, operation and launch task.*

**Legend**
- **P0** = MVP, must exist before first paid user · **P1** = before UTME season peak (Feb) · **P2** = after first cohort / nice to have
- **[VERIFY]** = a fact about JAMB/WAEC/regulation to confirm against an official source before building on it
- **[DECIDE]** = an open decision for the founder
- Feature IDs (e.g. `F-DIAG-01`) are stable so you can reference them in tickets, commits and prompts to other LLMs.

---

## Table of contents

1. Product summary and principles
2. Users and personas
3. Platform decision (web/PWA vs app vs WhatsApp)
4. End-to-end user journeys
5. Feature catalogue (every feature, with acceptance criteria)
6. The scoring and prediction engine
7. Study-plan engine
8. Content: question bank, explanations, syllabus, course data
9. Data model (database schema)
10. API surface
11. Integrations (OTP, WhatsApp, payments, AI, storage)
12. Architecture, infrastructure and DevOps
13. Offline and low-data strategy
14. Security, privacy and NDPA compliance
15. Admin console and internal tools
16. Analytics, events and dashboards
17. Notifications and messaging catalogue
18. Support operations
19. School mock-day operations
20. Lesson-teacher (affiliate) programme
21. Marketing assets and launch materials
22. Pricing, billing rules, refunds and guarantees
23. Legal and business setup
24. Testing and QA
25. Build plan, week by week
26. Budget
27. Metrics, kill criteria and review cadence
28. Master checklist (everything, in one list)

---

## 1. Product summary and principles

**One sentence:** a JAMB preparation service that predicts a student's score, tells them exactly what to study to reach the score their course needs, holds them accountable through their parents, and guides them from registration to admission — and that *actually works* (no double payment, real support, small updates).

**Promise:** *"Get the score your course needs."*

**Design principles (use these to settle arguments):**
1. **Outcome over content.** Every feature must move predicted score, completion rate, or admission success. If it doesn't, cut it.
2. **It just works.** One-tap sign-in, no double payments, works on a ₦60k Android, survives bad network. Reliability is the wedge against MySchool.
3. **Low data by default.** Text first, images compressed, video optional. Show download sizes.
4. **Parents are the buyer; students are the user.** Design two experiences.
5. **Honesty is a feature.** Predicted scores are honest even when bad. No fake testimonials, no "300+ guaranteed."
6. **Manual first, automate later.** If a human can do it for the first 100 users (parent reports, support, error review), do it by hand and automate once the pattern is clear.
7. **Ship weekly.** A small thing in front of students beats a big thing on your laptop.

---

## 2. Users and personas

| Persona | Who | Goal | Fears / pains | What they see |
|---|---|---|---|---|
| **Student (first-timer)** | SS3, 16–18, Lagos private school, shared or own Android | Get into chosen course | Computer anxiety, too much syllabus, time pressure in Maths, distractions | Student app |
| **Student (retaker)** | Finished school, 17–21, scored 160–199 last year | Not fail again | Shame, wasted year, money | Student app (retaker track) |
| **Parent / guardian** | Pays; often not tech-savvy; WhatsApp-native | Child admitted; money not wasted | Scams, child on phone not studying, shocks on results day | WhatsApp reports + simple web page |
| **Lesson teacher** | Runs a JAMB lesson for 20–60 students | Better results, more students, extra income | Losing students, being replaced by an app | Teacher dashboard |
| **School principal / proprietor** | Private secondary school | Better WAEC/JAMB results to market the school | Wasting class time, data/privacy trouble, vendors who disappear | Class readiness report + school dashboard (P2) |
| **Admin (you + helpers)** | Internal | Run the business | Wrong answers, angry users, payment issues | Admin console |
| **Content reviewer** | Subject teacher you pay per batch | Review questions/explanations | Unclear tasks | Review queue |

---

## 3. Platform decision

**Recommendation: Progressive Web App (PWA) first, WhatsApp as the parent and support channel, Android wrapper (Trusted Web Activity) on Play Store in P1.**

| Option | For | Against | Verdict |
|---|---|---|---|
| Native Android app | Play Store discovery, offline storage | Slow to build, store review, update size complaints, iOS later | P1 as a TWA wrapper around the PWA |
| **PWA (web app installable to home screen)** | One codebase, instant updates, no store gatekeeping, works on laptops/school computers (CBT practice on real keyboard+mouse), small | Weaker Play Store presence, iOS offline quirks | **P0** |
| WhatsApp-only bot | Zero install, parents already there | Can't do a real CBT simulation; Meta template costs; policy risk | Use for parents, reminders and support only |
| USSD/SMS | Feature phones | Can't do the product | No |

**[DECIDE]** Final name and domain. Working name used below: **"ScoreCoach"**. Check CAC name availability, `.ng`/`.com.ng` domain, and Play Store name collisions before spending on branding.

---

## 4. End-to-end user journeys

### 4.1 Student — free to paid (core funnel)
1. Lands from TikTok / school mock / teacher link / subject checker.
2. **Subject-combination checker** (no sign-up): picks course + university → sees required subjects and O'Level requirements → "Want to know if your score is good enough? Take the free diagnostic."
3. **Sign up with phone number + OTP** (one screen). Optional: name, school, state, parent's WhatsApp number.
4. **Onboarding (60 seconds):** exam year, target course + university (pre-filled from checker), the 3 subjects besides English, first-time or retaker, phone/laptop.
5. **Diagnostic mock** (timed, ~40–60 min, CBT-style) or "short diagnostic" (20 min) option.
6. **Result screen:** predicted score range, course target, the gap, marks needed per subject, 3 weakest topics, "students like you who followed the plan gained X in 6 weeks" (only once real data exists).
7. **Paywall:** free plan vs season pass. Parent-pay option: "Send to my parent" → generates a WhatsApp message with a payment link.
8. Payment (Paystack) → plan unlocked on account (not device).
9. Daily loop begins.

### 4.2 Student — daily loop (paid)
1. Open app → **Today card:** "25 Physics questions on Motion + review 8 mistakes · ~35 min."
2. Do practice set → instant feedback → explanation of wrong answer → mistake saved for spaced repetition.
3. Streak and minutes update; predicted score moves weekly.
4. Weekly mini-mock (Saturday) → updated predicted score → new week's plan.

### 4.3 Parent
1. Receives WhatsApp message from student ("pay for my JAMB plan") or school report.
2. Opens payment link → pays → gets WhatsApp confirmation with what's included and support number.
3. Every Sunday evening: weekly report (minutes studied, days active, predicted score trend, top improved topic, one thing to encourage).
4. Alerts: inactive 3 days; key dates (registration closes, mock, exam, results, CAPS).
5. Exam day: "arrived at centre" ping (student taps a button).
6. After results: admission navigator offer.

### 4.4 Lesson teacher
1. Signs up via referral form → verified by you (call).
2. Gets teacher code + dashboard.
3. Adds class (students join with code).
4. Sees class weakest topics, inactive students, predicted score distribution.
5. Earns commission per paid student; payout monthly.

### 4.5 School (mock day)
1. Principal agrees → date set.
2. You run paper or lab mock → mark → upload results.
3. School gets class readiness report in 48 hours.
4. Parents receive individual reports (through school channel, with consent) with offer link.
5. Follow-up meeting with principal → licence conversation (P2).

### 4.6 Retaker variant
- Onboarding asks last UTME score + subject scores → diagnostic calibrated against it → messaging: "Last year 182. This year's plan targets 240."

---

## 5. Feature catalogue

Format: **ID · Name · Priority** — description · acceptance criteria (AC).

### 5.1 Acquisition (free, no account)

**F-ACQ-01 · Subject-combination checker · P0**
Student/parent selects university → course; sees required UTME subjects, O'Level requirements, and notes (e.g. "Physics compulsory").
AC: works without login; loads in <3s on 3G; covers at least top 30 courses × top 20 universities students in Lagos/South-West apply to; every record shows "source: JAMB brochure [year], last checked [date]"; "Report wrong info" link; CTA to diagnostic.
[VERIFY] Data must come from the current JAMB brochure/IBASS; no scraping of paid sites.

**F-ACQ-02 · Cut-off / competitiveness lookup · P1**
For chosen course+university, show last known departmental cut-off or competitiveness band (High / Medium / Low).
AC: clearly labelled as historical; sourced; never presented as a guarantee.

**F-ACQ-03 · Shareable result card · P1**
After diagnostic, an image card ("My target: Medicine, UNILAG. Gap: 58 marks.") for WhatsApp status/TikTok.
AC: no exact score shown unless student opts in; includes link with referral code.

**F-ACQ-04 · Landing page · P0**
Promise, how it works (3 steps), checker embed, pricing, guarantee, FAQ, support WhatsApp, privacy summary.
AC: <500KB first load; works without JS for content; no fake testimonials.

**F-ACQ-05 · Referral codes · P1**
Each user/teacher has a code; referred buyer gets ₦X off, referrer earns credit/commission.
AC: attribution stored on payment; fraud check (self-referral by same phone blocked).

### 5.2 Account and access

**F-ACC-01 · Phone + OTP sign-in · P0**
Nigerian phone number → 6-digit OTP via SMS (WhatsApp OTP fallback P1).
AC: no username/password; resend after 60s; max 5 OTPs/hour/number; works for numbers starting 070/080/081/090/091; session lasts 90 days.

**F-ACC-02 · Account-based entitlement · P0**
Purchases attach to the account, not the device.
AC: reinstall, update, clearing cache or new phone → log in → everything still unlocked. Max 2 active devices at once (anti-sharing); user can kick old device themselves.

**F-ACC-03 · Profile & onboarding · P0**
Exam year, target course/university, subjects, first-timer/retaker, device type, school (optional), parent WhatsApp (optional, consented).
AC: editable later; changing subjects recalculates plan.

**F-ACC-04 · Parent link · P0**
Student adds parent number → parent receives WhatsApp opt-in message → parent confirms → reports start.
AC: explicit parent opt-in recorded; parent can stop with "STOP".

**F-ACC-05 · Account deletion & data export · P1**
AC: user can request deletion in-app; completed within 30 days; export as JSON/PDF.

### 5.3 Diagnostic and prediction

**F-DIAG-01 · Full diagnostic mock · P0**
CBT-style test across English + 3 chosen subjects, timed.
AC: question selection covers syllabus topics proportionally; autosaves every answer locally; survives page refresh/network loss; submits when back online.

**F-DIAG-02 · Short diagnostic · P0**
~20 min version for low-attention entry; lower confidence shown honestly ("±25").

**F-DIAG-03 · Predicted score report · P0**
Predicted UTME score as a range, per-subject estimate, topic mastery map (red/amber/green), 3 weakest high-value topics, gap to course target split by subject.
AC: range width reflects data volume; plain-language explanation of what the number means; never shows false precision.

**F-DIAG-04 · Retaker calibration · P1**
Uses last real UTME score to calibrate prediction.

### 5.4 Practice and learning (paid unless noted)

**F-PRAC-01 · Today plan card · P0** — see Section 7.
**F-PRAC-02 · Topic practice sets · P0** — 10–25 questions on one topic; instant feedback.
**F-PRAC-03 · Free daily practice · P0 (free tier)** — ~20 questions/day, answers only, no explanations.
**F-PRAC-04 · Mistake-level explanations · P0** — why the right answer is right AND why the chosen wrong option is wrong. Written/reviewed by humans for top topics; AI-assisted drafts reviewed before publishing.
AC: every explanation has `reviewed_by` and `reviewed_at`; unreviewed AI text is labelled or not shown.
**F-PRAC-05 · Mistake bank + spaced repetition · P0** — wrong answers return at 1, 3, 7, 14 days; variant questions where available.
**F-PRAC-06 · Bookmarks · P1**
**F-PRAC-07 · Pidgin / simple-English toggle for explanations · P2**
**F-PRAC-08 · Audio explanations (TTS) · P2**
**F-PRAC-09 · Topic micro-lessons · P1** — short text + diagram summary per syllabus topic (link to free YouTube where good ones exist rather than producing video early).
**F-PRAC-10 · Ask-a-question (AI tutor, scoped) · P2** — only answers about the current question/topic; rate-limited; logged for review.

### 5.5 CBT simulation and speed

**F-CBT-01 · CBT replica mock · P0** — layout modelled on the real JAMB interface: subject tabs, question navigator grid, timer, keyboard shortcuts (A/B/C/D, N/P for next/previous, S submit — [VERIFY] actual JAMB shortcuts), calculator (basic).
AC: works with mouse+keyboard on laptop/school PC and touch on phone; full-screen mode.
**F-CBT-02 · First-time-on-a-computer mode · P1** — guided tutorial: using a mouse, clicking options, navigating, submitting; practice with zero stakes.
**F-CBT-03 · Speed drills · P1** — per-question timer; "skip and return" training; Maths speed sets.
**F-CBT-04 · Time analytics · P1** — time per question, where time was wasted, unanswered count.
**F-CBT-05 · Disruption rehearsal · P2** — mock that simulates a delayed start / logout and teaches the student what to do.
**F-CBT-06 · Weekly mini-mock · P0** — Saturday, auto-scheduled; updates predicted score.

### 5.6 Progress and motivation

**F-PROG-01 · Predicted-score trend chart · P0**
**F-PROG-02 · Streaks and minutes · P0**
**F-PROG-03 · Readiness gate · P1** — "Target hit on 3 consecutive mocks: you're ready."
**F-PROG-04 · Class/school leaderboard · P2** — opt-in; ranks by improvement, not raw score.
**F-PROG-05 · Exam countdown · P0**

### 5.7 Journey (registration → admission)

**F-JRN-01 · Verified updates channel · P1** — WhatsApp channel + in-app feed; each post links to official JAMB source; "if it's not from JAMB or us, ignore it."
**F-JRN-02 · Registration checklist · P1** — what to bring, fees ([VERIFY] each year), how to avoid overcharging, profile code SMS steps.
**F-JRN-03 · Exam-day survival kit · P1** — PDF + WhatsApp series: centre location, arrival time, documents, what to do if logged out / delayed / computer fails, how JAMB reschedules, calm-down routine.
**F-JRN-04 · Arrived-safely ping · P2** — one tap sends parent WhatsApp message with time.
**F-JRN-05 · Results explainer · P1** — what your score means for your chosen course.
**F-JRN-06 · Admission navigator · P2 (upsell)** — realistic alternatives (course/university), CAPS status explainer, change-of-course timing, post-UTME prep link, deadline alerts.
**F-JRN-07 · Post-UTME packs · P2 (upsell)**

### 5.8 Parent experience

**F-PAR-01 · Parent payment link · P0** — student generates link; parent pays without creating an account.
**F-PAR-02 · Weekly WhatsApp report · P0** — manual/semi-automated at first (you generate from admin, send via WhatsApp Business), automated in P1.
Content: days active, minutes, questions done, predicted score trend, biggest improvement, one encouragement line, support contact.
**F-PAR-03 · Inactivity alert · P1** — 3 days inactive.
**F-PAR-04 · Parent web page · P1** — tokenised link (no login) showing the same report.
**F-PAR-05 · Key-date reminders · P1**

### 5.9 Teacher (affiliate) dashboard

**F-TCH-01 · Teacher sign-up + verification · P1**
**F-TCH-02 · Class codes · P1**
**F-TCH-03 · Class view · P1** — students, activity, weakest topics across class, predicted score distribution, inactive list.
**F-TCH-04 · Assign practice set to class · P2**
**F-TCH-05 · Earnings page · P1** — sales attributed, commission owed, payout history.

### 5.10 School

**F-SCH-01 · Paper mock answer sheet + marking · P0 (ops tool)** — printable OMR-style sheet; you enter or scan answers in admin (manual entry form first; OMR scanning P2).
**F-SCH-02 · Class readiness report (PDF) · P0** — distribution of predicted scores, weakest topics per subject, CBT readiness notes, recommendations.
**F-SCH-03 · Individual student report (PDF/WhatsApp) · P0**
**F-SCH-04 · School dashboard + licence · P2**

### 5.11 Billing

**F-BILL-01 · Paystack checkout (card, bank transfer, USSD) · P0**
**F-BILL-02 · Plans & entitlements · P0** — season pass (until exam date of selected year), single subject, upsells.
**F-BILL-03 · Coupon codes · P0** (early-bird, school, teacher)
**F-BILL-04 · Webhook-verified activation · P0** — never unlock on client-side callback alone.
**F-BILL-05 · Receipts via WhatsApp/SMS · P0**
**F-BILL-06 · Refunds (guarantee + goodwill) · P0 (manual in admin)**
**F-BILL-07 · Commission ledger · P1**

### 5.12 Support

**F-SUP-01 · WhatsApp support number visible everywhere · P0**
**F-SUP-02 · In-app "Report a problem" with auto-attached context (user id, device, last screen, app version) · P0**
**F-SUP-03 · "Report wrong answer" per question · P0** — reward: credit/extra days if confirmed.
**F-SUP-04 · Support SLA tracker · P1** — every ticket timestamped; 12-hour reply guarantee measured.
**F-SUP-05 · FAQ / help centre · P1**

### 5.13 Admin (see Section 15)

---

## 6. The scoring and prediction engine

### 6.1 Exam structure facts to encode — [VERIFY ALL against current JAMB brochure]
- 4 subjects: Use of English (compulsory) + 3 course-relevant subjects.
- Each subject scored out of 100 → total out of 400.
- Use of English typically 60 questions (incl. novel questions); other subjects typically 40 each; ~2 hours total.
- Store these as **configuration**, not code, so a rule change is a data edit.

### 6.2 MVP prediction (P0) — simple and honest
1. For each subject, compute weighted accuracy across topics, weighting each topic by its historical share of questions (from tagged past papers).
2. `subject_estimate = 100 × weighted_accuracy`, adjusted with a difficulty correction (questions tagged easy/medium/hard; harder correct answers count more).
3. `predicted_total = sum(subject_estimates)`.
4. Range: `± k / sqrt(n_questions_answered)` per subject, combined; floor of ±10, ceiling of ±40. Show the range, not one number.
5. Recency weighting: last 14 days count 2×.
6. Speed penalty: if the student's average time per question is above exam pace, discount the estimate (they'd run out of time).

### 6.3 Later (P2) — Item Response Theory
- Calibrate question difficulty/discrimination from your own response data (needs ~200+ responses per item).
- Estimate student ability per subject (Rasch/2PL model), map to score scale.
- Calibrate against **real UTME results** collected after the exam (ask users to report scores; incentivise with discount on post-UTME pack). Publish predicted-vs-actual accuracy honestly.

### 6.4 Rules
- Never show a prediction from fewer than 30 answered questions per subject — show "need more data" instead.
- Log every prediction with inputs (for audit and model improvement).
- The guarantee (Section 22) is measured on **this engine's mocks**, so the engine and mock difficulty must be stable across the 6-week window — version them.

---

## 7. Study-plan engine

### 7.1 Inputs
Target score per subject, current topic mastery, topic weight (frequency in past exams), days until exam, minutes/day the student commits (asked at onboarding: 20 / 40 / 60 / 90), mistakes due for review.

### 7.2 Topic priority score
```
priority(topic) = topic_weight × (1 − mastery) × learnability × urgency
```
- `topic_weight`: share of past-exam questions on this topic.
- `mastery`: 0–1 from recent accuracy.
- `learnability`: easier-to-fix topics first early on (configurable per topic by content team; default 1).
- `urgency`: rises as exam approaches for high-weight topics.

### 7.3 Daily plan algorithm
1. Reserve ~25% of the day's time for due mistakes (spaced repetition).
2. Fill the rest with the top 1–2 priority topics, rotating subjects so no subject is untouched for >3 days.
3. One speed drill block every 2nd day after week 2.
4. Saturday: weekly mini-mock instead of normal plan.
5. Final 2 weeks: shift to full mocks + mistake review only.
6. If the student misses a day: do not pile up; re-plan from today (shame-free).

### 7.4 MVP simplification
P0 can be a rule-based version: "top 2 weakest high-weight topics + due mistakes." No optimisation needed until there's data.

---

## 8. Content

Content is the heaviest workload. Plan it like a production line.

### 8.1 Syllabus taxonomy (P0)
- Subjects → topics → subtopics, mirroring the **official JAMB syllabus** for each subject. [VERIFY current syllabus]
- Every question is tagged to exactly one subtopic.
- MVP subjects (cover the most common combinations first): **Use of English, Mathematics, Physics, Chemistry, Biology, Economics, Government, Literature in English, CRS, Commerce, Accounting.** [DECIDE] final MVP list — check which combinations dominate in your first schools.

### 8.2 Question bank
**Sourcing — copyright matters:**
- Past JAMB questions: the questions themselves are widely reproduced, but **published booklets, apps and websites own their compilations, explanations and formatting.** Do not copy another app's database, explanations or images. [VERIFY with a lawyer what reuse of official past questions is permitted.]
- Safest path: (a) official past questions you transcribe yourself from primary sources, explanations written fresh; (b) **original JAMB-style questions** written by paid subject teachers, mapped to the syllabus.
- AI can draft variants and explanations, but **every published item is human-reviewed.**

**Targets:**
| Phase | Questions per subject | Explanations |
|---|---|---|
| P0 (pilot, Dec) | 300 per MVP subject (English 400) | All |
| P1 (Feb) | 800 per subject | All |
| P2 | 1,500+ | All + variants |

**Question record fields:** see `questions` table (Section 9). Includes source, year (if past question), difficulty, subtopic, correct option, per-option wrong-answer explanation, diagram asset, reviewer, status.

**Content pipeline:**
1. Draft (teacher or AI-assisted) → status `draft`
2. Review by second subject teacher → `reviewed` or `rejected` with note
3. Publish → `live`
4. User error report → `flagged` (auto-hidden after 3 independent reports pending review)
5. Fix → re-review → `live`; version kept

**Reviewer pay model [DECIDE]:** e.g. ₦X per question written, ₦Y per question reviewed; batch of 50 per subject per week.

**Quality targets:** error rate < 0.5% of served questions confirmed wrong; median fix time < 48h.

### 8.3 Prescribed novel module (P1)
- Current UTME novel [VERIFY title for 2027 — 2025/2026 cycle used *The Lekki Headmaster*; it may change].
- Chapter summaries written fresh (do not copy the book), character map, themes, 100+ questions.
- Copyright: summarise and analyse; never reproduce passages.

### 8.4 Course & admission data (P0 for checker)
Table of `university × course → required UTME subjects, O'Level requirements, special notes, source, checked_at`.
- Source: current JAMB brochure. Enter manually; double-check by a second person.
- Start with ~20 universities (UNILAG, LASU, UI, OAU, FUTA, UNILORIN, UNIBEN, UNN, ABU, FUNAAB, Covenant, Babcock, LAUTECH, OOU, UNIPORT, etc.) × top 30 courses.

### 8.5 Micro-lessons (P1)
One-page summary per high-weight topic: key ideas, formulas, worked example, common traps. Prefer text + simple SVG diagrams (low data).

### 8.6 Exam-day kit and registration guides (P1)
Written once per year; reviewed against the latest JAMB announcements.

---

## 9. Data model

PostgreSQL. UUID primary keys, `created_at`/`updated_at` on every table.

```sql
-- Identity
users(id, phone UNIQUE, name, role ENUM('student','parent','teacher','admin','reviewer'),
      state, school_id NULL, exam_year, status, last_seen_at)
devices(id, user_id, device_fingerprint, user_agent, last_active_at, revoked_at)
otp_requests(id, phone, code_hash, expires_at, attempts, channel ENUM('sms','whatsapp'))
student_profiles(user_id PK, track ENUM('first_timer','retaker'), last_utme_score NULL,
      target_university_id, target_course_id, daily_minutes, onboarding_done_at)
student_subjects(user_id, subject_id)  -- English always + 3
parent_links(id, student_id, parent_phone, parent_user_id NULL, opted_in_at, opted_out_at)

-- Catalogue / reference data
subjects(id, code, name, question_count_in_exam, active)
topics(id, subject_id, name, syllabus_ref, weight, learnability, parent_topic_id NULL)
universities(id, name, short_name, state, type)
courses(id, name)
course_requirements(id, university_id, course_id, utme_subjects JSONB,
      olevel_requirements TEXT, notes TEXT, source TEXT, checked_at, cutoff_hint NULL)
exam_config(id, year, key, value JSONB)  -- dates, durations, question counts, fees

-- Content
questions(id, subject_id, topic_id, stem TEXT, options JSONB, correct_option CHAR(1),
      explanation_correct TEXT, explanations_wrong JSONB, difficulty SMALLINT,
      source ENUM('past','original','variant'), past_year NULL, asset_ids UUID[],
      status ENUM('draft','reviewed','live','flagged','retired'), version INT,
      author_id, reviewed_by, reviewed_at)
question_reports(id, question_id, user_id, reason, note, status, resolved_by, resolved_at, reward_given)
assets(id, type, storage_key, bytes, width, height)
lessons(id, topic_id, body_md, status, reviewed_by)

-- Assessment
tests(id, user_id, type ENUM('diagnostic','short_diagnostic','mini_mock','full_mock',
      'practice','speed_drill','school_paper'), config JSONB, started_at, submitted_at,
      duration_seconds, engine_version)
test_items(id, test_id, question_id, position, chosen_option NULL, is_correct NULL,
      time_spent_ms, answered_at, flagged_by_student BOOL)
predictions(id, user_id, test_id NULL, total_low, total_mid, total_high,
      per_subject JSONB, inputs_hash, engine_version, created_at)
topic_mastery(user_id, topic_id, mastery NUMERIC, attempts INT, last_practised_at)
review_queue(id, user_id, question_id, due_at, interval_days, ease, last_result)

-- Planning & engagement
daily_plans(id, user_id, date, items JSONB, minutes_planned, completed_at NULL)
activity_days(user_id, date, minutes, questions_answered)  -- for streaks & reports
reported_utme_results(user_id, year, total, per_subject JSONB, proof_asset_id NULL)

-- Commerce
products(id, code, name, price_kobo, entitlement JSONB, active)
orders(id, user_id NULL, payer_phone, product_id, amount_kobo, coupon_id NULL,
      referrer_code NULL, status ENUM('pending','paid','failed','refunded'),
      paystack_reference UNIQUE, paid_at)
entitlements(id, user_id, product_id, order_id, starts_at, ends_at, revoked_at)
coupons(id, code UNIQUE, percent_off, amount_off_kobo, max_uses, used, expires_at, owner_teacher_id NULL)
refunds(id, order_id, reason ENUM('guarantee','goodwill','duplicate','error'), amount_kobo, approved_by, paystack_refund_id)
guarantee_claims(id, user_id, window_start, window_end, baseline_prediction_id,
      final_prediction_id, plan_completion_pct, eligible BOOL, decision, decided_by)

-- Teachers & schools
teachers(user_id PK, verified_at, referral_code UNIQUE, commission_pct, payout_account_ref)
classes(id, teacher_id NULL, school_id NULL, name, join_code UNIQUE)
class_members(class_id, student_id, joined_at)
commissions(id, teacher_id, order_id, amount_kobo, status ENUM('owed','paid','reversed'), paid_at)
schools(id, name, lga, state, contact_name, contact_phone, consent_doc_asset_id)
school_events(id, school_id, date, type ENUM('paper_mock','lab_mock'), students_count, report_asset_id)

-- Messaging & support
message_log(id, user_id NULL, phone, channel, template, payload JSONB, status, provider_id, sent_at)
support_tickets(id, user_id NULL, phone, channel, category, body, context JSONB,
      status, first_response_at, resolved_at, assignee_id)
announcements(id, title, body, official_source_url, published_at)

-- Analytics & audit
events(id, user_id NULL, anon_id, name, props JSONB, ts)   -- or ship to PostHog
audit_log(id, actor_id, action, entity, entity_id, before JSONB, after JSONB, ts)
```

Indexes: `test_items(test_id)`, `topic_mastery(user_id)`, `review_queue(user_id, due_at)`, `questions(subject_id, topic_id, status)`, `orders(paystack_reference)`, `activity_days(user_id, date)`.

---

## 10. API surface

REST, JSON, versioned `/v1`. Auth: short-lived access JWT (15 min) + rotating refresh token (90 days) bound to device.

**Auth**
- `POST /v1/auth/otp/request` {phone, channel}
- `POST /v1/auth/otp/verify` {phone, code, device} → tokens
- `POST /v1/auth/refresh` · `POST /v1/auth/logout` · `GET /v1/me/devices` · `DELETE /v1/me/devices/:id`

**Public (no auth)**
- `GET /v1/universities` · `GET /v1/courses?university=` · `GET /v1/requirements?university=&course=`
- `GET /v1/exam-config/:year` · `GET /v1/announcements`

**Profile**
- `GET/PATCH /v1/me` · `PUT /v1/me/subjects` · `POST /v1/me/parent-link`

**Tests**
- `POST /v1/tests` {type} → test with question payload (without answers)
- `PUT /v1/tests/:id/items/:position` {chosen_option, time_spent_ms} (idempotent; batched sync endpoint below)
- `POST /v1/tests/:id/sync` [{position, chosen_option, time_spent_ms, answered_at}] — offline batch
- `POST /v1/tests/:id/submit` → results + explanations (gated by entitlement)
- `GET /v1/tests/:id/review`

**Learning**
- `GET /v1/plan/today` · `POST /v1/plan/today/complete-item`
- `GET /v1/review/due` · `GET /v1/topics/:id/lesson`
- `GET /v1/predictions/latest` · `GET /v1/predictions/history`
- `GET /v1/progress` (streak, minutes, mastery map)

**Content pack (offline)**
- `GET /v1/packs/manifest?subjects=` → list of packs with version + size + hash
- `GET /v1/packs/:subject/:version` (signed URL to compressed JSON) · `GET /v1/packs/:subject/delta?from=` 

**Commerce**
- `GET /v1/products` · `POST /v1/checkout` {product, coupon, payer_phone} → Paystack authorization URL
- `POST /v1/webhooks/paystack` (signature verified)
- `GET /v1/me/entitlements` · `POST /v1/pay-link` (student → parent link)

**Reports**
- `POST /v1/questions/:id/report` · `POST /v1/support/tickets`
- `POST /v1/utme-results` (self-reported)

**Teacher**
- `GET /v1/teacher/classes` · `POST /v1/teacher/classes` · `GET /v1/teacher/classes/:id/overview` · `GET /v1/teacher/earnings`

**Parent (token link, no login)**
- `GET /v1/parent/report/:token`

**Admin** — separate app, separate auth with 2FA; all writes audited.

**Webhooks in**: Paystack, WhatsApp (message status, inbound messages), SMS delivery reports.

---

## 11. Integrations

| Need | Primary | Fallback | Notes |
|---|---|---|---|
| OTP SMS | Termii (DND-route) | Africa's Talking / Twilio | Nigerian DND rules affect delivery; test with MTN, Airtel, Glo, 9mobile. [VERIFY pricing] |
| WhatsApp messaging | WhatsApp Business Cloud API (Meta) via direct or a BSP | WhatsApp Business app manually for first 100 users | Template messages need Meta approval; per-conversation pricing [VERIFY current NG rates]; parent must opt in. Check Meta's policy on AI chatbots — use WhatsApp for reports/alerts/human support, not an open AI bot. |
| Payments | Paystack (card, transfer, USSD) | Flutterwave | Verify via webhook + `transaction/verify`; store kobo integers. |
| Payouts to teachers | Paystack Transfers | Manual bank transfer | Needs business account + KYC. |
| AI drafting (internal only) | An LLM API for drafting explanations/variants in the admin tool | — | Never serve unreviewed AI text to students; log prompts/outputs. Dollar cost → keep usage internal and batch. |
| Storage/CDN | Cloudflare R2 + Cloudflare CDN | S3 + CloudFront | Images as WebP, <40KB each. |
| Email (receipts/admin) | Resend / Postmark | — | Low priority; WhatsApp is primary. |
| Analytics | PostHog (self-host or EU cloud) | Plausible for landing page | Respect consent; no third-party ad trackers in the student app. |
| Error tracking | Sentry | — | Frontend + backend. |
| Uptime | Better Stack / UptimeRobot | — | Alerts to your WhatsApp/phone. |

---

## 12. Architecture, infrastructure and DevOps

### 12.1 Stack (chosen for your skills and speed)
- **Frontend:** Next.js (App Router) as a PWA; TypeScript; Tailwind; service worker via Workbox/serwist; IndexedDB (Dexie) for offline tests/packs.
- **Backend:** NestJS (TypeScript) monolith with modules: auth, catalogue, content, tests, engine, plans, commerce, messaging, teacher, admin, reports.
- **DB:** PostgreSQL 16 (managed). **Cache/queues:** Redis + BullMQ (OTP rate limits, report generation, WhatsApp sends, plan generation).
- **PDF generation:** server-side (e.g. Playwright HTML→PDF or a PDF library) for school/parent reports.
- **Admin:** separate Next.js app or a module behind `/admin` with role checks + 2FA.

Keep it a **modular monolith**. No microservices, no Kubernetes for MVP — you know K8s, which is exactly why you should resist it here.

### 12.2 Hosting (cheap, reliable, close to Lagos)
- App + API: a single VPS/region with good latency to Nigeria (e.g. a European region) or a PaaS (Render/Fly/Railway). [DECIDE] by cost and latency test from an Ikorodu MTN connection.
- Managed Postgres with daily backups + point-in-time recovery.
- Cloudflare in front (CDN, TLS, WAF, caching static packs).

### 12.3 Environments
`local` → `staging` (seeded data, Paystack test keys) → `production`. Feature flags for paid features and experiments.

### 12.4 CI/CD
- GitHub Actions: lint, typecheck, unit tests, build, migrate (staging), e2e smoke (Playwright), deploy.
- Database migrations via Prisma/TypeORM migrations; never manual SQL in prod.
- Tagged releases; one-click rollback.

### 12.5 Reliability targets
- Availability 99.5% during Jan–Apr; 99% otherwise.
- p95 API latency < 400ms from Lagos.
- Zero lost answers: client-side autosave + idempotent sync.
- Backups tested monthly (restore into staging).
- Payment webhook processing idempotent (dedupe by reference).

### 12.6 Observability
Sentry, structured logs (JSON) with request ids, uptime checks on landing, API health, Paystack webhook endpoint, OTP send success rate dashboard.

### 12.7 Load
Peak risk: the week before UTME and results day. Load test to 1,000 concurrent test-takers before February (k6).

---

## 13. Offline and low-data strategy

1. **Content packs:** each subject's live questions bundled as compressed JSON (gzip/brotli), versioned. Typical target: <1.5MB per subject per 800 questions (text only). Images downloaded lazily.
2. **Delta updates:** client sends current version; server returns only changed/new/retired items. Show size before download ("Update: 180KB").
3. **Offline test-taking:** tests generated from local pack; answers saved to IndexedDB; sync on reconnect; server re-scores (never trust client score for predictions or guarantee).
4. **Entitlement offline:** cache signed entitlement token with expiry (e.g. 14 days); re-validate when online.
5. **Explanations:** included in packs only for entitled users (pack per entitlement tier) — accept that a determined user could extract them; don't over-engineer DRM.
6. **Data saver mode (default on):** no autoplay, no remote fonts, compressed images.
7. **Budget:** first visit < 500KB; app shell < 300KB gzipped.
8. **Wi-Fi/Bluetooth sharing:** P2 — exportable pack file teachers can share; still requires login to unlock paid parts.

---

## 14. Security, privacy and NDPA compliance

Users are **mostly minors (16–17)**. Treat this as a high-sensitivity product.

**Privacy & consent**
- Nigeria Data Protection Act 2023 + GAID 2025 apply. [VERIFY obligations; consider registering with NDPC if thresholds met.]
- Collect minimum data: phone, name, exam info, learning data. No location tracking, no contacts access, no camera except optional result-slip upload.
- Parent/guardian consent for under-18s: at minimum, parent opt-in for reports; [DECIDE with legal advice] whether parental consent is required for account creation.
- Privacy policy in plain English + Pidgin summary. Data never sold. No ad trackers.
- School data: written consent from school for mock-day data processing; parent reports sent through school channel or with parent opt-in.
- Retention: delete inactive accounts' learning data after 24 months; keep financial records as required by law.

**Security**
- OTP hashed, rate-limited, lockout on brute force.
- JWT short-lived; refresh tokens rotated, device-bound, revocable.
- RBAC: student / parent / teacher / reviewer / admin; admin 2FA mandatory.
- All admin actions in `audit_log`.
- Paystack secret keys in a secrets manager; webhook signature verification; no card data touches your servers.
- OWASP top 10 checks; dependency scanning (Dependabot); rate limiting at Cloudflare and app.
- Encrypt backups; least-privilege DB users.
- Child safety: no open chat between users; no public profiles; leaderboard shows first name + initial only, opt-in.

---

## 15. Admin console and internal tools

**P0**
- Users: search by phone; view profile, entitlements, devices, tests, tickets; revoke device; grant days (goodwill).
- Orders: view, reconcile with Paystack, issue refund, mark guarantee claim.
- Content: question CRUD, bulk import (CSV/JSON), review queue, flagged queue with user reports, version history.
- Course requirements editor with source + checked date.
- School mock: create event, enter paper answers per student (fast keyboard entry), generate class + individual PDF reports.
- Parent report generator: list of students due a weekly report → preview → send (manual click first).
- Support inbox (or link to WhatsApp Business + ticket log).

**P1**
- Teacher management, commissions ledger, payout export.
- Coupon management.
- Announcement publisher (in-app + WhatsApp channel).
- Engine dashboard: prediction distribution, average weekly gain, guarantee eligibility tracker.

**P2**
- OMR sheet scanning; AI-assisted drafting UI with mandatory review step; A/B experiment config.

---

## 16. Analytics, events and dashboards

**Event taxonomy (snake_case):**
`landing_viewed`, `checker_used` {university, course}, `diagnostic_started` {type, source}, `diagnostic_completed` {predicted_mid}, `paywall_viewed`, `pay_link_created`, `checkout_started` {product}, `payment_succeeded` {product, amount, coupon, referrer}, `payment_failed`, `plan_item_completed`, `practice_answered` {correct, topic, time_ms}, `mock_completed` {type, predicted_mid}, `streak_extended`, `explanation_viewed`, `question_reported`, `support_ticket_created`, `parent_opted_in`, `parent_report_sent`, `teacher_class_created`, `student_joined_class`, `offline_sync_completed` {items}, `pack_downloaded` {bytes}.

**Dashboards**
1. **Funnel:** landing → checker → diagnostic started → completed → paywall → paid (by source).
2. **Engagement:** DAU/WAU, days active per week, minutes per day, plan completion %.
3. **Outcomes:** average predicted-score gain by week since purchase; % hitting target.
4. **Quality:** question error reports per 1,000 served; time to fix.
5. **Support:** median first response time; % within 12h.
6. **Revenue:** revenue by channel, CAC by channel, refund rate, upsell take-rate.
7. **Reliability:** OTP success by network, sync failures, crash-free sessions.

---

## 17. Notifications and messaging catalogue

| Code | Channel | Trigger | Audience | Priority |
|---|---|---|---|---|
| `otp` | SMS (WA fallback) | Login | Student/parent | P0 |
| `payment_success` | WhatsApp/SMS | Paystack webhook | Payer | P0 |
| `pay_request` | WhatsApp (student shares) | Student taps "ask parent" | Parent | P0 |
| `parent_optin` | WhatsApp template | Parent link added | Parent | P0 |
| `weekly_report` | WhatsApp template | Sunday 6pm | Opted-in parent | P0 |
| `daily_nudge` | Push (web push) | 5pm if not studied | Student | P1 |
| `inactive_3d` | WhatsApp | 3 days no activity | Parent | P1 |
| `mock_ready` | Push | Saturday 9am | Student | P1 |
| `key_date` | WhatsApp channel + push | Registration, mock, exam, results, CAPS | All | P1 |
| `arrived_safe` | WhatsApp | Student taps | Parent | P2 |
| `results_followup` | WhatsApp | Results released | Paid users | P1 |
| `guarantee_check` | WhatsApp | Week 6 | Eligible students | P1 |

Rules: quiet hours 9pm–7am; max 1 parent message/week except alerts they opted into; every template has opt-out.

Write all templates in plain English, warm, short. Example weekly report:
> *"Good evening! Here's Tolu's JAMB week: studied 5 of 7 days (3h 40m). Predicted score: 192 → 205 (+13). Biggest improvement: Physics – Motion. Target for Medicine at UNILAG: 260+. A quick 'well done' goes a long way. Questions? Reply here."*

---

## 18. Support operations

- **Channels:** one WhatsApp Business number (on a dedicated phone/SIM), in-app form.
- **Hours:** 8am–9pm; guarantee: reply within 12 hours.
- **Saved replies (P0):** OTP not received; paid but not unlocked; new phone; wrong answer report; refund request; parent wants to stop messages; how predicted score works; exam-day issue.
- **Triage SLA:** payment issues first, then access, then content.
- **Paid-but-not-unlocked runbook:** search phone → check Paystack reference → if paid and no entitlement, run reconcile → reply with confirmation. Target: under 15 minutes.
- **Escalation:** anything involving a minor's safety, threats, or scams → you personally, same day.
- **Help centre (P1):** 20 FAQ articles.
- **Weekly review:** top 5 ticket categories → product fixes.

---

## 19. School mock-day operations

**Before**
1. Warm intro → visit principal with one-page proposal (Section 21).
2. Agree: date, class size, lab or paper, consent letter, how parent reports are sent.
3. Prepare: printed question papers (versioned, numbered), answer sheets, pencils, timer, attendance list template, consent form.

**On the day (≈3 hours)**
1. 15-min intro: what CBT is like, how prediction works.
2. Mock (60–90 min short version across English + 3 subjects, or English + Maths only for mixed classes [DECIDE]).
3. Collect sheets; count; seal.

**After (within 48 hours)**
1. Enter answers in admin (aim: 2 min per student with keyboard entry; hire help for >80 students).
2. Generate class report + individual reports.
3. Meet principal (15 min) to walk through class report.
4. Individual reports to parents via school channel/opt-in, with free-diagnostic + offer link and coupon `SCHOOLNAME`.
5. Log conversions per school.

**Kit costs per event [ESTIMATE]:** printing ~₦300–500/student, transport, refreshments optional.

---

## 20. Lesson-teacher affiliate programme

- **Offer to teachers:** free dashboard; your students get X% off; you earn Y% of every sale + bonus at 20 paid students. [DECIDE] Y between 20–30%.
- **Recruitment:** teachers you meet via schools, JAMB lesson posters in Ikorodu/Lagos, Facebook/WhatsApp groups.
- **Onboarding call (15 min):** demo, explain commission, give poster + WhatsApp message templates.
- **Payouts:** monthly, by bank transfer; statement on dashboard.
- **Rules:** no false claims ("guaranteed 300"), no spam; commission reversed on refund.
- **Positioning to teachers:** "We don't replace you; we show you which students are stuck on what."

---

## 21. Marketing assets and launch materials

**P0**
- Landing page (Section 5.1).
- One-page school proposal (PDF): problem (CBT shift, results), free mock day, what the school gets, data/privacy promise, contact.
- Parent explainer (WhatsApp-friendly image + text).
- Teacher one-pager + poster.
- 10 short videos scripted: "JAMB topics that show up every year," "Why you ran out of time in Maths," "Wrong subject combination can cost you admission," "What to do if your system logs out," "How the predicted score works."
- WhatsApp channel set up with first 10 verified posts.
- Brand basics: name, logo, 2 colours, font.

**P1**
- Free subject-checker campaign timed to registration opening (January).
- Referral programme launch.
- Case studies (only with real consented results).

**Rules:** no fake testimonials, no fabricated statistics, no implied JAMB affiliation (include "not affiliated with JAMB").

---

## 22. Pricing, billing rules, refunds and guarantees

**Prices to test** (Section 7 of the brief): ₦5,000 / ₦12,000 / ₦20,000 tiers. Early-bird coupon until a fixed date.

| Tier [DECIDE names] | Includes |
|---|---|
| Free | Checker, full diagnostic, ~20 questions/day (answers only), 1 mock/month |
| Season Pass | Everything in Layer 2 + weekly parent report until exam |
| Season Pass + Teacher | Above + enrolled in a lesson teacher's class with dashboard follow-up |
| Add-ons | Admission navigator, post-UTME pack, single subject |

**Billing rules**
- Season pass ends 7 days after the selected year's UTME date (stored in `exam_config`).
- One account; max 2 devices; device swap self-service.
- Coupons don't stack.

**Score-gain guarantee (mock-based)**
- Window: 6 weeks from purchase. Baseline = first full diagnostic after purchase.
- Eligible if: plan completion ≥ 80% of days AND ≥ 4 weekly mini-mocks completed.
- Claim if predicted score rises < 30 points → full refund.
- Measured on the same engine version; automated eligibility check in admin; human approves.
- [DECIDE] Pilot the 30-point threshold on the first cohort without advertising it; set the public number from real data.

**Service guarantee:** support reply within 12 hours or 30 extra days free.

**Refunds:** via Paystack; target processing within 5 business days; log reason.

---

## 23. Legal and business setup

- [ ] Business name or Ltd registration with CAC [DECIDE: Ltd preferred for school contracts and payments].
- [ ] Check employment contract(s) for IP, moonlighting and conflict-of-interest clauses before building. This is not insurance-related, but confirm.
- [ ] Business bank account; Paystack business verification.
- [ ] TIN (you'll know this well from the tax idea).
- [ ] Terms of service; privacy policy; refund & guarantee policy; teacher affiliate agreement; school MoU + data consent letter; content reviewer agreement (IP assignment of written questions/explanations to the company).
- [ ] Trademark check on the name.
- [ ] Legal opinion on use of past JAMB questions and novel summaries.
- [ ] "Not affiliated with JAMB" disclaimer everywhere.
- [ ] NDPA review (minors' data).

---

## 24. Testing and QA

- **Unit:** engine (prediction, plan, spaced repetition), entitlement logic, coupon maths, webhook idempotency.
- **Integration:** OTP flow per network; Paystack test cards/transfer; WhatsApp template sends.
- **E2E (Playwright):** sign-up → diagnostic → pay → plan → mock → offline answer → sync.
- **Device lab:** at least 3 real low-end Androids (e.g. Tecno, Infinix, itel with 2–3GB RAM), one old laptop running Chrome, one school-lab style Windows PC.
- **Network tests:** throttled 3G, offline mid-test, airplane mode during submit.
- **Content QA:** 100% of P0 questions double-reviewed; random 5% audit weekly.
- **Pilot:** 20–30 students for 2 weeks before taking public payments.
- **Accessibility basics:** font sizes, contrast, tap targets ≥ 44px.

---

## 25. Build plan, week by week

Assumes ~15–20 hours/week (evenings + weekends). If tax pre-sale goes first, shift everything right by the weeks spent there. Content work runs in parallel with a paid subject teacher.

| Week | Dates (2026–27) | Engineering | Content | Business / sales |
|---|---|---|---|---|
| 0 | 16–25 Oct | Repo, CI, staging, DB schema v1, auth (OTP) | Choose MVP subjects; recruit 2 subject teachers; set pay rates | Name + domain; CAC registration started; check employment contract |
| 1 | 26 Oct–1 Nov | Catalogue + course requirements + checker (public) | Enter course requirements for first 10 universities | Draft school one-pager; list 30 target schools from warm network |
| 2 | 2–8 Nov | Question model, admin content CRUD, review queue, bulk import | 150 questions/subject drafted | Contact 5 schools |
| 3 | 9–15 Nov | Test engine: diagnostic, autosave, submit, scoring | 300/subject reviewed (English 400) | Book first mock day |
| 4 | 16–22 Nov | Prediction v1 + result screen + paywall; Paystack + webhooks + entitlements | Explanations for all P0 questions | Contact 5 schools; recruit 3 teachers |
| 5 | 23–29 Nov | Daily plan (rule-based), practice sets, mistake bank + spaced repetition | Topic weights from past-paper tagging | **Mock day #1** (paper); pilot cohort of 20 starts |
| 6 | 30 Nov–6 Dec | School paper-mock entry + PDF reports; parent report generator (manual send) | Micro-lessons for top 20 topics | Mock day #2; early-bird pre-sale opens |
| 7 | 7–13 Dec | CBT replica UI + weekly mini-mock; offline packs v1 | 500/subject | Mock day #3; measure conversion vs kill criteria |
| 8 | 14–20 Dec | Support tooling, error reports, admin user tools, Sentry, backups test | Novel module v1 [VERIFY 2027 novel] | Decide: scale or fix offer |
| 9–10 | 21 Dec–3 Jan | Hardening, load test, PWA install, delta updates | 800/subject target | Holiday content push (TikTok) |
| 11 | 4–10 Jan | Teacher dashboard + class codes + commissions | Exam-day kit, registration guide | Teacher programme launch |
| 12 | 11–17 Jan | WhatsApp templates automated; inactivity alerts; referral codes | Verified-updates channel posts | Prepare registration campaign |
| 13–18 | Late Jan–Feb | First-time-on-computer mode, speed drills, time analytics; Play Store TWA | Ongoing review + error fixes | **Registration window campaign** (checker + diagnostic); scale schools/teachers |
| 19–23 | Mar–Apr | Readiness gate, results explainer, disruption rehearsal | Full mocks; final-weeks plan | Mock UTME push; exam-day kit; arrived-safe |
| 24+ | May → | Admission navigator, post-UTME, WAEC module, IRT calibration | WAEC content | Collect real results; publish accuracy; plan year 2 |

**MVP definition (end of Week 7):** checker, OTP, diagnostic, prediction, paywall + Paystack, daily plan, practice with explanations, mistake review, weekly mini-mock, parent report (semi-manual), support WhatsApp, school paper-mock reports, admin for content/users/orders.

---

## 26. Budget (first season, rough — replace with quotes)

| Item | Estimate |
|---|---|
| Content: 2 subject teachers writing/reviewing (Nov–Feb) | ₦400k–900k [ESTIMATE] |
| Hosting, DB, CDN, Sentry, PostHog | ~$40–80/month |
| SMS OTP | ~₦4–6 per SMS [VERIFY] × volume |
| WhatsApp templates | per-conversation fees [VERIFY] |
| Paystack fees | ~1.5% + ₦100 local, capped [VERIFY] |
| Printing for mock days | ₦300–500/student |
| Transport & school visits | ₦50k–150k |
| Test devices (3 low-end Androids) | ₦200k–300k (or borrow) |
| Legal (terms, privacy, opinion on past questions) | ₦150k–400k |
| CAC registration + domain + branding | ₦50k–150k |
| Marketing (content, small ad tests) | ₦100k–300k |

Hormozi rule: pre-sales and early-bird cash should fund content costs. If pre-sales don't cover the first content batch, that's a signal.

---

## 27. Metrics, kill criteria and review cadence

**North-star metric:** number of paying students whose predicted score rose ≥ 30 points in 6 weeks.

**Weekly review (Sunday, 30 min):** funnel numbers, conversion by channel, plan completion, average gain, support SLA, error reports, cash in/out, one decision for next week.

**Kill / pivot criteria** (from the brief):
- 3 school mock days → <3% parents pay → fix offer/price before more schools.
- <3 of first 10 schools agree to a mock → rework pitch.
- 200 diagnostics → <10% buy → reposition.
- <3 of 10 teachers distribute → distribution broken.
- CAC > first-30-day revenue after 3 channel tests → stop paid acquisition.
- Pilot cohort average gain < 15 points in 6 weeks → the product doesn't work yet; fix before scaling.

---

## 28. Master checklist — everything, in one list

### Strategy & decisions
- [ ] Run tax pre-sale test first (or consciously decide JAMB goes first)
- [ ] Get external LLM review of the venture brief; update this spec
- [ ] [DECIDE] product name, domain, brand
- [ ] [DECIDE] MVP subject list
- [ ] [DECIDE] price tiers to test and early-bird deadline
- [ ] [DECIDE] guarantee threshold after pilot data
- [ ] [DECIDE] teacher commission %
- [ ] [DECIDE] hosting provider after latency test

### Verification ([VERIFY] items)
- [ ] Current JAMB exam structure (questions per subject, duration, scoring, shortcuts)
- [ ] Current JAMB syllabus per subject
- [ ] 2027 prescribed novel
- [ ] 2027 registration dates and fees
- [ ] JAMB brochure course requirements for target universities
- [ ] Legal position on past questions and novel summaries
- [ ] NDPA obligations for minors' data
- [ ] SMS, WhatsApp, Paystack current pricing
- [ ] Meta WhatsApp policy for this use case
- [ ] Lagos candidate count (381,814 vs 321,814)

### Legal & admin
- [ ] Employment contract check
- [ ] CAC registration
- [ ] Business bank account + Paystack verification
- [ ] Terms, privacy, refund/guarantee policy
- [ ] Teacher affiliate agreement
- [ ] School MoU + consent letter
- [ ] Reviewer agreement with IP assignment
- [ ] Trademark check
- [ ] "Not affiliated with JAMB" disclaimer

### Engineering — foundation
- [ ] Repo, monorepo structure (web, api, admin)
- [ ] CI/CD, staging, production
- [ ] Postgres schema v1 + migrations
- [ ] Redis + BullMQ
- [ ] Sentry, logging, uptime checks
- [ ] Backups + restore test
- [ ] Cloudflare (CDN, TLS, WAF)
- [ ] Secrets management
- [ ] Feature flags

### Engineering — features
- [ ] F-ACQ-01 checker · F-ACQ-04 landing
- [ ] F-ACC-01 OTP · F-ACC-02 entitlements · F-ACC-03 onboarding · F-ACC-04 parent link
- [ ] F-DIAG-01/02/03 diagnostic + prediction report
- [ ] F-PRAC-01/02/03/04/05 plan, practice, free tier, explanations, spaced repetition
- [ ] F-CBT-01 replica · F-CBT-06 weekly mini-mock
- [ ] F-PROG-01/02/05 trend, streaks, countdown
- [ ] F-PAR-01 pay link · F-PAR-02 weekly report
- [ ] F-SCH-01/02/03 paper mock + reports
- [ ] F-BILL-01–06 payments, plans, coupons, webhooks, receipts, refunds
- [ ] F-SUP-01/02/03 support + error reports
- [ ] Admin P0 tools
- [ ] Offline packs + delta updates + offline test sync
- [ ] PWA install + data-saver
- [ ] P1 set: F-ACQ-02/03/05, F-ACC-05, F-DIAG-04, F-PRAC-06/09, F-CBT-02/03/04, F-PROG-03, F-JRN-01/02/03/05, F-PAR-03/04/05, F-TCH-01/02/03/05, F-BILL-07, F-SUP-04/05, WhatsApp automation, Play Store TWA
- [ ] P2 set: IRT engine, F-PRAC-07/08/10, F-CBT-05, F-PROG-04, F-JRN-04/06/07, F-TCH-04, F-SCH-04, OMR scanning, WAEC module

### Content
- [ ] Syllabus taxonomy entered
- [ ] Topic weights from tagged past papers
- [ ] 300/subject (P0) → 800/subject (P1) reviewed questions
- [ ] Explanations (correct + each wrong option)
- [ ] Micro-lessons for top topics
- [ ] Novel module
- [ ] Course requirements for 20 universities × 30 courses
- [ ] Exam-day kit, registration guide, results explainer
- [ ] Content review SOP + error-fix SLA

### Operations
- [ ] Dedicated support WhatsApp number + saved replies
- [ ] Runbooks: paid-not-unlocked, OTP failures, refund, exam-week incident
- [ ] School mock-day kit + checklist
- [ ] Parent report send routine (Sunday)
- [ ] Weekly metrics review routine
- [ ] Teacher onboarding script + payout routine

### Go-to-market
- [ ] List of 30 target schools (warm intros first)
- [ ] School one-pager PDF
- [ ] Teacher one-pager + poster
- [ ] Parent explainer
- [ ] 10 short videos
- [ ] WhatsApp verified-updates channel
- [ ] Early-bird pre-sale
- [ ] Registration-window campaign (January)
- [ ] Referral programme

### Quality
- [ ] Device lab (3 low-end Androids + lab PC)
- [ ] Network/offline tests
- [ ] Load test 1,000 concurrent before February
- [ ] Pilot cohort (20–30 students, 2 weeks)
- [ ] Prediction accuracy review after UTME results

---

*End of specification. When asking another LLM to help, paste this file plus the venture brief, and ask it to (1) find gaps, (2) cut scope for a 7-week MVP, (3) challenge the engine design, and (4) write tickets for a specific section by feature ID.*
