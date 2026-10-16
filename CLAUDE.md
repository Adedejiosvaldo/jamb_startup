# ScoreCoach — agent notes

- Spec: `docs/build-spec.md` (feature IDs like `F-DIAG-03`). Progress: `docs/progress.md` — update it with each change.
- UI work: follow `DESIGN.md` and the skills in `.claude/skills/` (`baseline-ui`, `fixing-accessibility`,
  from ibelick/ui-skills, MIT).
- Checks before pushing: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
  API tests need Postgres (`scorecoach_test`).
- Schema changes: edit `apps/api/prisma/schema.prisma`, then `pnpm --filter @scorecoach/api db:migrate --name <change>`.
- Money is kobo integers. Never unlock paid features from a client callback — only the Paystack webhook / verify.
- Never serve unreviewed question content to students (`status = live` only).
- Values marked [VERIFY] in seeds/config are unconfirmed JAMB facts; do not present them as official.
