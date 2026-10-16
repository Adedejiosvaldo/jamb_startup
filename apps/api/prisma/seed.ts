/**
 * Reference data seed. Idempotent: safe to run on every deploy.
 * Every value marked [VERIFY] must be checked against the current JAMB
 * brochure/syllabus before launch (spec §6.1, §8.1). Exam rules live in
 * exam_config so a JAMB rule change is a data edit, not a code change.
 */
import { PrismaClient } from '@prisma/client';
import { SYLLABUS } from './content/syllabus';

const prisma = new PrismaClient();

// [DECIDE] final MVP list (spec §8.1). [VERIFY] question counts per subject.
const SUBJECTS = [
  { code: 'ENG', name: 'Use of English', questionCountInExam: 60 },
  { code: 'MTH', name: 'Mathematics', questionCountInExam: 40 },
  { code: 'PHY', name: 'Physics', questionCountInExam: 40 },
  { code: 'CHM', name: 'Chemistry', questionCountInExam: 40 },
  { code: 'BIO', name: 'Biology', questionCountInExam: 40 },
  { code: 'ECO', name: 'Economics', questionCountInExam: 40 },
  { code: 'GOV', name: 'Government', questionCountInExam: 40 },
  { code: 'LIT', name: 'Literature in English', questionCountInExam: 40 },
  { code: 'CRS', name: 'Christian Religious Studies', questionCountInExam: 40 },
  { code: 'COM', name: 'Commerce', questionCountInExam: 40 },
  { code: 'ACC', name: 'Accounting', questionCountInExam: 40 },
];

// [VERIFY ALL] against the 2027 JAMB brochure once published.
const EXAM_CONFIG_2027: Record<string, unknown> = {
  subjects_per_candidate: 4,
  compulsory_subject: 'ENG',
  max_score_per_subject: 100,
  max_total_score: 400,
  duration_minutes: 120,
  question_counts: { ENG: 60, default: 40 },
  utme_window: { start: null, end: null }, // fill when JAMB announces
  registration_window: { start: null, end: null },
  registration_fee_kobo: null,
  prescribed_novel: null, // [VERIFY] 2027 title
};

async function main(): Promise<void> {
  for (const s of SUBJECTS) {
    await prisma.subject.upsert({ where: { code: s.code }, update: s, create: s });
  }
  for (const [key, value] of Object.entries(EXAM_CONFIG_2027)) {
    await prisma.examConfig.upsert({
      where: { year_key: { year: 2027, key } },
      update: {}, // never overwrite values an admin has corrected
      create: { year: 2027, key, value: value as object },
    });
  }
  // Syllabus topics (spec §8.1). Create-only: never overwrite weights an admin has tuned.
  let created = 0;
  for (const [code, topics] of Object.entries(SYLLABUS)) {
    const subject = await prisma.subject.findUnique({ where: { code } });
    if (!subject) continue;
    for (const t of topics) {
      const existing = await prisma.topic.findFirst({
        where: { subjectId: subject.id, OR: [{ syllabusRef: t.ref }, { name: t.name }] },
      });
      if (existing) continue;
      await prisma.topic.create({
        data: {
          subjectId: subject.id,
          name: t.name,
          syllabusRef: t.ref,
          weight: 1 / topics.length,
        },
      });
      created += 1;
    }
  }
  console.log(
    `Seeded ${SUBJECTS.length} subjects, ${Object.keys(EXAM_CONFIG_2027).length} exam_config keys, ${created} new syllabus topics.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
