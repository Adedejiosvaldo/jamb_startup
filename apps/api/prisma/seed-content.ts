/**
 * Imports original JAMB-style questions from prisma/content/questions/*.json.
 *
 * Default: every question is created as a DRAFT. Nothing reaches students until
 * a subject teacher reviews it in /admin and an admin publishes it (CLAUDE.md:
 * never serve unreviewed content). Idempotent: questions whose stem already
 * exists in the subject are skipped.
 *
 *   pnpm --filter @scorecoach/api db:seed:content
 *   pnpm --filter @scorecoach/api db:seed:content -- --dev-publish   # LOCAL ONLY: mark live for a preview
 */
import { PrismaClient } from '@prisma/client';
import { loadContentQuestions } from './content/load';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const devPublish = process.argv.includes('--dev-publish');
  if (devPublish && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
    throw new Error(
      '--dev-publish is for local preview only. Review and publish in /admin instead.',
    );
  }
  const questions = loadContentQuestions();
  const topics = await prisma.topic.findMany({ include: { subject: true } });
  const topicId = new Map(topics.map((t) => [`${t.subject.code}::${t.name}`, t]));

  let created = 0;
  let skipped = 0;
  for (const q of questions) {
    const topic = topicId.get(`${q.subjectCode}::${q.topicName}`);
    if (!topic)
      throw new Error(
        `Topic "${q.topicName}" (${q.subjectCode}) not in the database — run db:seed first.`,
      );
    const exists = await prisma.question.findFirst({
      where: { subjectId: topic.subjectId, stem: q.stem },
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    await prisma.question.create({
      data: {
        subjectId: topic.subjectId,
        topicId: topic.id,
        stem: q.stem,
        options: q.options,
        correctOption: q.correctOption,
        explanationCorrect: q.explanationCorrect,
        explanationsWrong: q.explanationsWrong,
        difficulty: q.difficulty,
        source: q.source,
        pastYear: q.pastYear ?? null,
        status: devPublish ? 'live' : 'draft',
      },
    });
    created += 1;
  }
  console.log(
    `Content: ${created} new question(s) as ${devPublish ? 'LIVE (local preview only)' : 'drafts for review'}, ${skipped} already present.`,
  );
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
