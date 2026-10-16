/**
 * DEV/STAGING DEMO DATA ONLY. Refuses to run when NODE_ENV=production.
 *
 * Creates placeholder topics, questions, universities, courses, requirements,
 * products and an admin user so every flow can be exercised locally. All
 * non-maths questions are obvious placeholders marked [DEMO]; maths questions
 * are generated arithmetic so the answers are genuinely correct.
 * Requirements are marked "DEMO — not verified against the JAMB brochure".
 */
import { PrismaClient, QuestionSource } from '@prisma/client';

const prisma = new PrismaClient();

/** Placeholder questions per syllabus topic, so every test type has enough to draw from locally. */
const QUESTIONS_PER_TOPIC = 8;
const LETTERS = ['A', 'B', 'C', 'D'] as const;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function mathsQuestion(r: () => number, i: number) {
  const a = 3 + Math.floor(r() * 40);
  const b = 2 + Math.floor(r() * 25);
  const kinds = [
    { stem: `Evaluate ${a} × ${b}.`, ans: a * b },
    { stem: `Solve for x: x + ${a} = ${a + b}.`, ans: b },
    { stem: `What is ${a * b} ÷ ${b}?`, ans: a },
    { stem: `Find the sum of ${a}, ${b} and ${a + b}.`, ans: 2 * (a + b) },
  ];
  const k = kinds[i % kinds.length]!;
  const wrong = new Set<number>();
  while (wrong.size < 3) {
    const w = k.ans + (Math.floor(r() * 11) - 5);
    if (w !== k.ans && w > 0) wrong.add(w);
  }
  const correctIdx = Math.floor(r() * 4);
  const values = [...wrong];
  values.splice(correctIdx, 0, k.ans);
  const options = Object.fromEntries(LETTERS.map((l, idx) => [l, String(values[idx])]));
  const correct = LETTERS[correctIdx]!;
  const explanationsWrong = Object.fromEntries(
    LETTERS.filter((l) => l !== correct).map((l) => [
      l,
      `${options[l]} is not right — recheck the arithmetic.`,
    ]),
  );
  return {
    stem: k.stem,
    options,
    correct,
    explanation: `The answer is ${k.ans}.`,
    explanationsWrong,
  };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to seed demo data in production.');

  const admin = await prisma.user.upsert({
    where: { phone: '+2348000000001' },
    update: { role: 'admin', name: 'Demo Admin' },
    create: { phone: '+2348000000001', role: 'admin', name: 'Demo Admin' },
  });
  const reviewer = await prisma.user.upsert({
    where: { phone: '+2348000000002' },
    update: { role: 'reviewer', name: 'Demo Reviewer' },
    create: { phone: '+2348000000002', role: 'reviewer', name: 'Demo Reviewer' },
  });

  // Fill each syllabus topic (from `db:seed`) with placeholders up to QUESTIONS_PER_TOPIC live questions.
  let qCount = 0;
  const topics = await prisma.topic.findMany({
    include: { subject: true },
    orderBy: { syllabusRef: 'asc' },
  });
  if (!topics.length) throw new Error('No topics — run db:seed first.');
  for (const [ti, topic] of topics.entries()) {
    const code = topic.subject.code;
    const name = topic.name;
    const have = await prisma.question.count({ where: { topicId: topic.id, status: 'live' } });
    const r = rng(code.charCodeAt(0) * 1000 + ti);
    const rows = [];
    for (let i = have; i < QUESTIONS_PER_TOPIC; i++) {
      const q =
        code === 'MTH'
          ? mathsQuestion(r, i)
          : (() => {
              const correct = LETTERS[Math.floor(r() * 4)]!;
              return {
                stem: `[DEMO] Practice item ${i + 1} on ${name}. Placeholder content — replace with reviewed questions. The correct option is ${correct}.`,
                options: Object.fromEntries(LETTERS.map((l) => [l, `${name} option ${l}`])),
                correct,
                explanation: `[DEMO] ${correct} is correct for this placeholder.`,
                explanationsWrong: Object.fromEntries(
                  LETTERS.filter((l) => l !== correct).map((l) => [
                    l,
                    `[DEMO] ${l} is a distractor.`,
                  ]),
                ),
              };
            })();
      rows.push({
        subjectId: topic.subjectId,
        topicId: topic.id,
        stem: q.stem,
        options: q.options,
        correctOption: q.correct,
        explanationCorrect: q.explanation,
        explanationsWrong: q.explanationsWrong,
        difficulty: 1 + Math.floor(r() * 3),
        source: QuestionSource.original,
        status: 'live' as const,
        authorId: admin.id,
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
      });
    }
    if (rows.length) qCount += (await prisma.question.createMany({ data: rows })).count;
  }

  const universities = [
    { name: 'University of Lagos', shortName: 'UNILAG', state: 'Lagos', type: 'federal' },
    { name: 'Lagos State University', shortName: 'LASU', state: 'Lagos', type: 'state' },
    { name: 'University of Ibadan', shortName: 'UI', state: 'Oyo', type: 'federal' },
    { name: 'Obafemi Awolowo University', shortName: 'OAU', state: 'Osun', type: 'federal' },
    {
      name: 'Federal University of Technology, Akure',
      shortName: 'FUTA',
      state: 'Ondo',
      type: 'federal',
    },
  ];
  const courses: [
    string,
    { required: string[]; choose: { count: number; from: string[] }[] },
    number,
  ][] = [
    ['Medicine and Surgery', { required: ['ENG', 'BIO', 'CHM', 'PHY'], choose: [] }, 270],
    [
      'Computer Science',
      { required: ['ENG', 'MTH', 'PHY'], choose: [{ count: 1, from: ['CHM', 'BIO', 'ECO'] }] },
      240,
    ],
    [
      'Law',
      { required: ['ENG', 'LIT'], choose: [{ count: 2, from: ['GOV', 'CRS', 'ECO', 'COM'] }] },
      250,
    ],
    [
      'Economics',
      { required: ['ENG', 'MTH', 'ECO'], choose: [{ count: 1, from: ['GOV', 'COM', 'ACC'] }] },
      220,
    ],
    [
      'Accounting',
      { required: ['ENG', 'MTH', 'ACC'], choose: [{ count: 1, from: ['ECO', 'COM', 'GOV'] }] },
      220,
    ],
    ['Electrical Engineering', { required: ['ENG', 'MTH', 'PHY', 'CHM'], choose: [] }, 230],
  ];
  for (const u of universities) {
    const uni = await prisma.university.upsert({ where: { name: u.name }, update: u, create: u });
    for (const [name, subjects, cutoff] of courses) {
      const course = await prisma.course.upsert({ where: { name }, update: {}, create: { name } });
      await prisma.courseRequirement.upsert({
        where: { universityId_courseId: { universityId: uni.id, courseId: course.id } },
        update: {},
        create: {
          universityId: uni.id,
          courseId: course.id,
          utmeSubjects: subjects,
          olevelRequirements:
            'Five credits including English Language and Mathematics, at not more than two sittings. [DEMO]',
          notes: 'DEMO DATA — not verified against the JAMB brochure.',
          cutoffHint: 'Demo value',
          cutoffScore: cutoff,
          source: 'DEMO — not verified against the JAMB brochure',
          checkedAt: new Date(),
        },
      });
    }
  }

  await prisma.product.upsert({
    where: { code: 'SEASON_PASS' },
    update: {},
    create: {
      code: 'SEASON_PASS',
      name: 'Season Pass',
      priceKobo: 1_200_000, // ₦12,000 — [DECIDE] test ₦5k/₦12k/₦20k (spec §22)
      entitlement: { kind: 'season_pass' },
    },
  });
  await prisma.coupon.upsert({
    where: { code: 'EARLYBIRD' },
    update: {},
    create: {
      code: 'EARLYBIRD',
      percentOff: 25,
      maxUses: 500,
      expiresAt: new Date('2027-01-31T23:00:00Z'),
    },
  });
  await prisma.examConfig.upsert({
    where: { year_key: { year: 2027, key: 'utme_window' } },
    update: {},
    create: { year: 2027, key: 'utme_window', value: { start: '2027-04-24', end: '2027-05-05' } },
  });
  const demoTitle = '[DEMO] Registration has not opened yet';
  if (!(await prisma.announcement.findFirst({ where: { title: demoTitle } })))
    await prisma.announcement.create({
      data: {
        title: demoTitle,
        body: 'We will post here as soon as JAMB announces dates. If it is not from JAMB or us, ignore it.',
        officialSourceUrl: 'https://www.jamb.gov.ng',
        publishedAt: new Date(),
      },
    });

  console.log(
    `Demo seed done: ${qCount} new questions, admin ${admin.phone}, reviewer ${reviewer.phone}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
