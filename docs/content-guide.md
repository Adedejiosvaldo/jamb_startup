# Content guide — questions, syllabus, past questions

Content is the bottleneck (spec §8). This is how it gets into ScoreCoach safely.

## What's in the repo

| What                                                                 | Where                                                                           | Status                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Syllabus topics, 11 subjects (250 topics)                            | `apps/api/prisma/content/syllabus.ts`, loaded by `db:seed`                      | **[VERIFY]** against the current syllabus on ibass.jamb.gov.ng. Weights are equal placeholders until past papers are tagged. |
| 220 original JAMB-style questions with explanations for every option | `apps/api/prisma/content/questions/<SUBJECT>.json`, loaded by `db:seed:content` | Imported as **drafts**. A subject teacher must review each before it goes live.                                              |
| CSV template                                                         | `/templates/questions-template.csv` (web)                                       | Use for new batches and transcribed past questions.                                                                          |

`pnpm --filter @scorecoach/api test` validates every content file: topic exists in the syllabus, four distinct
options, why-wrong text for every wrong option, and the answer key is spread across A–D.

## Pipeline (spec §8.2)

1. **Write** — teacher writes in the CSV template (or `/admin/questions/new`).
2. **Import** — `/admin/questions/import` → everything lands as `draft`. Nothing imports if any row is invalid.
3. **Review** — a _different_ teacher (role `reviewer`) checks answer, wording, explanation; approves in bulk or one by one.
4. **Publish** — an admin publishes reviewed questions. Only `live` questions reach students.
5. **Fix** — students report errors; 3 independent reports auto-hide a question. Edits create a new version and go back to review.

Quality bar: < 0.5% of served questions confirmed wrong; fix within 48 hours.

## Past questions — what we will and won't do

- **We don't copy** another app's or website's question bank, explanations, diagrams or formatting
  (MySchool, Prepclass, etc.). Their compilations and explanations are their work.
- **Official past questions** may be transcribed **from primary sources** (JAMB-published materials you own), with
  explanations written fresh by our teachers. Set `source = past` and `pastYear`. Get the legal opinion in spec §23
  before publishing these at scale.
- **Original JAMB-style questions** (`source = original`) are the safest path and should be most of the bank.
- AI may draft variants and explanations, but every published item is human-reviewed (spec §8.2).

## Targets

| Phase            | Questions per subject |
| ---------------- | --------------------- |
| Pilot (December) | 300 (English 400)     |
| February         | 800                   |
| Later            | 1,500+                |

## Dev preview only

`pnpm --filter @scorecoach/api db:seed:content -- --dev-publish` marks the 220 originals live in a **local** database so
you can try them. It refuses to run on Vercel or with `NODE_ENV=production`.
