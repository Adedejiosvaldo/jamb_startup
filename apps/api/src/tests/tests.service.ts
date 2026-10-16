import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Question, Test, TestItem, TestType } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ApiError } from '../auth/auth.errors';
import { EntitlementsService } from '../commerce/entitlements.service';
import { lagosDate } from '../common/time';
import {
  BLUEPRINTS,
  ENGINE_VERSION,
  FREE_TIER,
  PRACTICE,
  PREDICTION,
  REVIEW,
  SPEED_DRILL,
} from '../engine/engine.config';
import { predict, SubjectInput } from '../engine/prediction';
import { allocateByWeight, shuffle } from '../engine/selection';
import { nextReview } from '../engine/spaced-repetition';
import { PrismaService } from '../prisma/prisma.service';
import { AnswerDto, CreateTestDto } from './tests.dto';

const DAY = 24 * 60 * 60 * 1000;
/** Allow late submits from phones that went offline mid-test. */
const SUBMIT_GRACE_MS = 24 * 60 * 60 * 1000;

interface TestConfig {
  mode?: 'review';
  subjects: string[];
  topicId?: string;
  subjectCode?: string;
  planItemId?: string;
  explanations: boolean;
}

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // ───────────────────────────── create ─────────────────────────────

  async create(userId: string, dto: CreateTestDto) {
    const paid = await this.entitlements.isPaid(userId);
    const subjects = await this.studentSubjects(userId);
    const type: TestType = dto.type === 'review' ? 'practice' : dto.type;
    const config: TestConfig = { subjects, explanations: paid, planItemId: dto.planItemId };
    let questionIds: string[] = [];
    let minutes: number | null = null;

    if (BLUEPRINTS[type]) {
      if (subjects.length !== 4) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'SUBJECTS_REQUIRED',
          'Choose your 4 subjects first.',
        );
      }
      if ((type === 'mini_mock' || type === 'full_mock') && !paid)
        await this.assertFreeMock(userId);
      const bp = BLUEPRINTS[type]!;
      minutes = bp.minutes;
      const counts = await this.questionCounts(type);
      for (const code of subjects) {
        questionIds.push(
          ...(await this.pickForSubject(
            userId,
            code,
            code === 'ENG' ? counts.ENG : counts.default,
          )),
        );
      }
    } else if (dto.type === 'review') {
      if (!paid) this.paywall('Mistake review is part of the Season Pass.');
      const due = await this.prisma.reviewQueueItem.findMany({
        where: { userId, dueAt: { lte: new Date() }, question: { status: 'live' } },
        orderBy: { dueAt: 'asc' },
        take: Math.min(dto.count ?? REVIEW.maxPerSession, REVIEW.maxPerSession),
      });
      if (!due.length)
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'NOTHING_DUE',
          'No mistakes are due for review. Nice work.',
        );
      questionIds = shuffle(due.map((d) => d.questionId));
      config.mode = 'review';
    } else if (type === 'speed_drill') {
      if (!paid) this.paywall('Speed drills are part of the Season Pass.');
      const code = (dto.subjectCode ?? 'MTH').toUpperCase();
      questionIds = await this.pickForSubject(userId, code, SPEED_DRILL.count);
      minutes = Math.ceil((SPEED_DRILL.count * 40) / 60);
      config.subjectCode = code;
      config.subjects = [code];
    } else {
      // Topic practice (F-PRAC-02); free users get FREE_TIER.practiceQuestionsPerDay (F-PRAC-03).
      if (!dto.topicId)
        throw new ApiError(HttpStatus.BAD_REQUEST, 'TOPIC_REQUIRED', 'Pick a topic to practise.');
      const topic = await this.prisma.topic.findUnique({
        where: { id: dto.topicId },
        include: { subject: true },
      });
      if (!topic) throw new ApiError(HttpStatus.NOT_FOUND, 'TOPIC_NOT_FOUND', 'Topic not found.');
      let count = Math.min(
        PRACTICE.max,
        Math.max(PRACTICE.min, dto.count ?? PRACTICE.defaultCount),
      );
      if (!paid) {
        const left = FREE_TIER.practiceQuestionsPerDay - (await this.freePracticeUsedToday(userId));
        if (left <= 0)
          this.paywall(
            `You've done today's ${FREE_TIER.practiceQuestionsPerDay} free questions. Come back tomorrow or get the Season Pass.`,
          );
        count = Math.min(count, left);
      }
      questionIds = await this.pickFromTopic(userId, topic.id, count);
      config.topicId = topic.id;
      config.subjects = [topic.subject.code];
    }

    if (!questionIds.length) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'NO_QUESTIONS',
        'There are no questions available for this yet.',
      );
    }

    const test = await this.prisma.test.create({
      data: {
        userId,
        type,
        config: config as unknown as Prisma.InputJsonValue,
        durationSeconds: minutes ? minutes * 60 : null,
        engineVersion: ENGINE_VERSION,
        items: { create: questionIds.map((questionId, i) => ({ questionId, position: i + 1 })) },
      },
    });
    return this.payload(userId, test.id);
  }

  /** In-progress tests the student can resume. */
  async open(userId: string) {
    const tests = await this.prisma.test.findMany({
      where: { userId, submittedAt: null, startedAt: { gt: new Date(Date.now() - 7 * DAY) } },
      orderBy: { startedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return tests.map((t) => ({
      id: t.id,
      type: t.type,
      startedAt: t.startedAt,
      questions: t._count.items,
      config: t.config,
    }));
  }

  /** Test payload for the CBT screen. Never includes correct answers. */
  async payload(userId: string, testId: string) {
    const test = await this.owned(userId, testId);
    const items = await this.prisma.testItem.findMany({
      where: { testId },
      orderBy: { position: 'asc' },
      include: { question: { include: { subject: true } } },
    });
    const config = test.config as unknown as TestConfig;
    const subjects = await this.prisma.subject.findMany({
      where: { code: { in: config.subjects } },
    });
    const order = (code: string) => config.subjects.indexOf(code);
    return {
      id: test.id,
      type: test.type,
      mode: config.mode ?? null,
      startedAt: test.startedAt,
      submittedAt: test.submittedAt,
      durationSeconds: test.durationSeconds,
      endsAt: test.durationSeconds
        ? new Date(test.startedAt.getTime() + test.durationSeconds * 1000)
        : null,
      subjects: subjects
        .sort((a, b) => order(a.code) - order(b.code))
        .map((s) => ({ code: s.code, name: s.name })),
      items: items.map((i) => ({
        position: i.position,
        questionId: i.questionId,
        subjectCode: i.question.subject.code,
        stem: i.question.stem,
        options: i.question.options,
        assetIds: i.question.assetIds,
        chosenOption: i.chosenOption,
        flagged: i.flaggedByStudent,
        timeSpentMs: i.timeSpentMs,
      })),
    };
  }

  // ───────────────────────────── answers ─────────────────────────────

  async answer(userId: string, testId: string, position: number, dto: AnswerDto) {
    const test = await this.owned(userId, testId);
    this.assertOpen(test);
    if (test.type !== 'practice') {
      await this.applyAnswers(testId, [{ position, ...dto }]);
      return { saved: true };
    }

    // Practice (F-PRAC-02): instant feedback, so the first answer is final.
    const item = await this.prisma.testItem.findUnique({
      where: { testId_position: { testId, position } },
      include: { question: true },
    });
    if (!item) throw new ApiError(HttpStatus.NOT_FOUND, 'ITEM_NOT_FOUND', 'Question not found.');
    if (item.chosenOption === null && dto.chosenOption !== null) {
      await this.applyAnswers(testId, [{ position, ...dto }]);
    } else if (dto.flagged !== undefined || dto.timeSpentMs !== undefined) {
      await this.applyAnswers(testId, [
        {
          position,
          flagged: dto.flagged,
          timeSpentMs: dto.timeSpentMs,
          chosenOption: item.chosenOption as AnswerDto['chosenOption'],
          answeredAt: dto.answeredAt,
        },
      ]);
    }
    const chosen = item.chosenOption ?? dto.chosenOption;
    if (chosen === null) return { saved: true };
    const config = test.config as unknown as TestConfig;
    const q = item.question;
    return {
      saved: true,
      feedback: {
        chosenOption: chosen,
        isCorrect: chosen === q.correctOption,
        correctOption: q.correctOption,
        explanationCorrect: config.explanations ? q.explanationCorrect : null,
        explanationsWrong: config.explanations ? q.explanationsWrong : null,
      },
    };
  }

  /** Offline batch (spec §13.3). Last write wins by answeredAt; idempotent. */
  async sync(userId: string, testId: string, items: (AnswerDto & { position: number })[]) {
    const test = await this.owned(userId, testId);
    this.assertOpen(test);
    await this.applyAnswers(testId, items, test.type === 'practice');
    return { saved: items.length };
  }

  private async applyAnswers(
    testId: string,
    items: (AnswerDto & { position: number })[],
    lockAnswered = false,
  ) {
    if (!items.length) return;
    const existing = await this.prisma.testItem.findMany({
      where: { testId, position: { in: items.map((i) => i.position) } },
    });
    const byPos = new Map(existing.map((e) => [e.position, e]));
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const it of items) {
      const row = byPos.get(it.position);
      if (!row) continue;
      const at = it.answeredAt ?? new Date();
      if (row.answeredAt && row.answeredAt > at) continue; // stale write from another tab/device
      if (lockAnswered && row.chosenOption !== null && it.chosenOption !== row.chosenOption)
        continue;
      ops.push(
        this.prisma.testItem.update({
          where: { id: row.id },
          data: {
            chosenOption: it.chosenOption,
            ...(it.timeSpentMs !== undefined ? { timeSpentMs: it.timeSpentMs } : {}),
            ...(it.flagged !== undefined ? { flaggedByStudent: it.flagged } : {}),
            answeredAt: at,
          },
        }),
      );
    }
    await this.prisma.$transaction(ops);
  }

  // ───────────────────────────── submit ─────────────────────────────

  async submit(userId: string, testId: string, items: (AnswerDto & { position: number })[] = []) {
    const test = await this.owned(userId, testId);
    if (test.submittedAt) return this.results(userId, testId);
    if (
      test.durationSeconds &&
      Date.now() > test.startedAt.getTime() + test.durationSeconds * 1000 + SUBMIT_GRACE_MS
    ) {
      this.logger.warn(`Late submit for test ${testId}`);
    }
    await this.applyAnswers(testId, items, test.type === 'practice');

    const now = new Date();
    const rows = await this.prisma.testItem.findMany({
      where: { testId },
      include: { question: true },
    });
    // Server-side scoring only (spec §13.3).
    const claimed = await this.prisma.test.updateMany({
      where: { id: testId, submittedAt: null },
      data: {
        submittedAt: now,
        durationSeconds: test.durationSeconds
          ? Math.min(
              test.durationSeconds,
              Math.round((now.getTime() - test.startedAt.getTime()) / 1000),
            )
          : Math.round(rows.reduce((s, r) => s + (r.timeSpentMs ?? 0), 0) / 1000),
      },
    });
    if (claimed.count !== 1) return this.results(userId, testId); // concurrent submit
    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.testItem.update({
          where: { id: r.id },
          data: {
            isCorrect: r.chosenOption !== null && r.chosenOption === r.question.correctOption,
          },
        }),
      ),
    );

    const config = test.config as unknown as TestConfig;
    const scored = rows.map((r) => ({
      ...r,
      isCorrect: r.chosenOption !== null && r.chosenOption === r.question.correctOption,
    }));
    await this.updateMastery(userId, [...new Set(rows.map((r) => r.question.topicId))]);
    await this.updateReviewQueue(userId, scored, now);
    await this.recordActivity(userId, scored, now);
    if (config.planItemId) await this.completePlanItem(userId, config.planItemId, now);
    if (BLUEPRINTS[test.type]?.predicts) await this.savePrediction(userId, testId);
    await this.prisma.event.create({
      data: { userId, name: 'mock_completed', props: { type: test.type, testId } },
    });
    return this.results(userId, testId);
  }

  async results(userId: string, testId: string) {
    const test = await this.owned(userId, testId);
    if (!test.submittedAt)
      throw new ApiError(HttpStatus.CONFLICT, 'NOT_SUBMITTED', 'Submit the test to see results.');
    const paid = await this.entitlements.isPaid(userId);
    const items = await this.prisma.testItem.findMany({
      where: { testId },
      orderBy: { position: 'asc' },
      include: { question: { include: { subject: true, topic: true } } },
    });

    const bySubject = new Map<
      string,
      { code: string; name: string; correct: number; total: number }
    >();
    const byTopic = new Map<
      string,
      { topicId: string; name: string; subjectCode: string; correct: number; total: number }
    >();
    for (const i of items) {
      const s = bySubject.get(i.question.subject.code) ?? {
        code: i.question.subject.code,
        name: i.question.subject.name,
        correct: 0,
        total: 0,
      };
      s.total += 1;
      s.correct += i.isCorrect ? 1 : 0;
      bySubject.set(s.code, s);
      const t = byTopic.get(i.question.topicId) ?? {
        topicId: i.question.topicId,
        name: i.question.topic.name,
        subjectCode: i.question.subject.code,
        correct: 0,
        total: 0,
      };
      t.total += 1;
      t.correct += i.isCorrect ? 1 : 0;
      byTopic.set(t.topicId, t);
    }
    const prediction = await this.prisma.prediction.findFirst({
      where: { testId },
      orderBy: { createdAt: 'desc' },
    });
    const correct = items.filter((i) => i.isCorrect).length;
    return {
      test: {
        id: test.id,
        type: test.type,
        submittedAt: test.submittedAt,
        durationSeconds: test.durationSeconds,
      },
      score: {
        correct,
        total: items.length,
        perSubject: [...bySubject.values()].map((s) => ({
          ...s,
          scaled: Math.round((100 * s.correct) / s.total),
        })),
      },
      prediction: prediction && this.presentPrediction(prediction),
      weakestTopics: [...byTopic.values()]
        .filter((t) => t.total >= 2)
        .map((t) => ({ ...t, accuracy: t.correct / t.total }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 3),
      explanationsLocked: !paid,
      items: items.map((i) => ({
        position: i.position,
        questionId: i.questionId,
        subjectCode: i.question.subject.code,
        topicName: i.question.topic.name,
        stem: i.question.stem,
        options: i.question.options,
        chosenOption: i.chosenOption,
        correctOption: i.question.correctOption,
        isCorrect: i.isCorrect,
        timeSpentMs: i.timeSpentMs,
        explanationCorrect: paid ? i.question.explanationCorrect : null,
        explanationsWrong: paid ? i.question.explanationsWrong : null,
      })),
    };
  }

  // ───────────────────────────── engine plumbing ─────────────────────────────

  /** Recompute prediction from the student's whole recent history (spec §6.2). */
  async savePrediction(userId: string, testId: string | null) {
    const subjects = await this.studentSubjects(userId);
    if (subjects.length !== 4) return null;
    const since = new Date(Date.now() - PREDICTION.lookbackDays * DAY);
    const answered = await this.prisma.testItem.findMany({
      where: { test: { userId, submittedAt: { not: null, gte: since } }, isCorrect: { not: null } },
      include: {
        question: {
          select: { topicId: true, difficulty: true, subject: { select: { code: true } } },
        },
        test: { select: { type: true, submittedAt: true } },
      },
      orderBy: { id: 'asc' },
    });
    const topics = await this.prisma.topic.findMany({
      where: { subject: { code: { in: subjects } } },
      include: { subject: true },
    });

    const input: SubjectInput[] = subjects.map((code) => ({
      code,
      topics: topics
        .filter((t) => t.subject.code === code)
        .map((t) => ({ id: t.id, weight: Number(t.weight) })),
      items: answered
        .filter((a) => a.question.subject.code === code)
        .map((a) => ({
          topicId: a.question.topicId,
          correct: !!a.isCorrect,
          difficulty: a.question.difficulty,
          answeredAt: a.answeredAt ?? a.test.submittedAt!,
          timeMs: a.timeSpentMs,
          timed: !!BLUEPRINTS[a.test.type],
        })),
    }));
    const result = predict(input);
    if (!result.total) return null;

    const inputsHash = createHash('sha256')
      .update(answered.map((a) => `${a.id}:${a.isCorrect ? 1 : 0}`).join(','))
      .digest('hex');
    return this.prisma.prediction.create({
      data: {
        userId,
        testId,
        totalLow: result.total.low,
        totalMid: result.total.mid,
        totalHigh: result.total.high,
        perSubject: {
          status: result.status,
          speedFactor: result.speedFactor,
          subjects: result.perSubject,
        } as unknown as Prisma.InputJsonValue,
        inputsHash,
        engineVersion: ENGINE_VERSION,
      },
    });
  }

  presentPrediction(p: {
    id: string;
    totalLow: number;
    totalMid: number;
    totalHigh: number;
    perSubject: Prisma.JsonValue;
    engineVersion: string;
    createdAt: Date;
  }) {
    const ps = p.perSubject as { status: string; speedFactor: number; subjects: unknown[] };
    return {
      id: p.id,
      low: p.totalLow,
      mid: p.totalMid,
      high: p.totalHigh,
      status: ps.status,
      speedFactor: ps.speedFactor,
      perSubject: ps.subjects,
      engineVersion: p.engineVersion,
      createdAt: p.createdAt,
    };
  }

  private async updateMastery(userId: string, topicIds: string[]) {
    const now = new Date();
    for (const topicId of topicIds) {
      const recent = await this.prisma.testItem.findMany({
        where: {
          test: { userId, submittedAt: { not: null } },
          question: { topicId },
          isCorrect: { not: null },
        },
        orderBy: { answeredAt: 'desc' },
        take: 30,
        select: { isCorrect: true, answeredAt: true },
      });
      const attempts = await this.prisma.testItem.count({
        where: {
          test: { userId, submittedAt: { not: null } },
          question: { topicId },
          isCorrect: { not: null },
        },
      });
      if (!recent.length) continue;
      // Recency-weighted accuracy: newest answers count most.
      let num = 0;
      let den = 0;
      recent.forEach((r, idx) => {
        const w = 1 / (1 + idx * 0.1);
        num += w * (r.isCorrect ? 1 : 0);
        den += w;
      });
      // Shrink toward 0.5 when there's little evidence.
      const mastery = (num + 1) / (den + 2);
      await this.prisma.topicMastery.upsert({
        where: { userId_topicId: { userId, topicId } },
        update: { mastery, attempts, lastPractisedAt: now },
        create: { userId, topicId, mastery, attempts, lastPractisedAt: now },
      });
    }
  }

  private async updateReviewQueue(
    userId: string,
    items: (TestItem & { question: Question; isCorrect: boolean })[],
    now: Date,
  ) {
    for (const i of items) {
      if (i.chosenOption === null && !i.isCorrect) {
        // Unanswered: treat as a mistake only in timed tests where they ran out of time? Keep it simple: skip.
        continue;
      }
      const existing = await this.prisma.reviewQueueItem.findUnique({
        where: { userId_questionId: { userId, questionId: i.questionId } },
      });
      const next = nextReview(
        existing && { intervalDays: existing.intervalDays },
        i.isCorrect,
        now,
      );
      if (!next) {
        if (existing) await this.prisma.reviewQueueItem.delete({ where: { id: existing.id } });
        continue;
      }
      await this.prisma.reviewQueueItem.upsert({
        where: { userId_questionId: { userId, questionId: i.questionId } },
        update: { intervalDays: next.intervalDays, dueAt: next.dueAt, lastResult: i.isCorrect },
        create: {
          userId,
          questionId: i.questionId,
          intervalDays: next.intervalDays,
          dueAt: next.dueAt,
          lastResult: i.isCorrect,
        },
      });
    }
  }

  private async recordActivity(userId: string, items: TestItem[], now: Date) {
    const answered = items.filter((i) => i.chosenOption !== null).length;
    const minutes = Math.round(items.reduce((s, i) => s + (i.timeSpentMs ?? 0), 0) / 60_000);
    const date = lagosDate(now);
    await this.prisma.activityDay.upsert({
      where: { userId_date: { userId, date } },
      update: { minutes: { increment: minutes }, questionsAnswered: { increment: answered } },
      create: { userId, date, minutes, questionsAnswered: answered },
    });
  }

  private async completePlanItem(userId: string, itemId: string, now: Date) {
    const plan = await this.prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date: lagosDate(now) } },
    });
    if (!plan) return;
    const items = (
      plan.items as { id: string; completedAt?: string | null; locked?: boolean }[]
    ).map((i) =>
      i.id === itemId && !i.completedAt ? { ...i, completedAt: now.toISOString() } : i,
    );
    const allDone = items.filter((i) => !i.locked).every((i) => i.completedAt);
    await this.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: {
        items: items as unknown as Prisma.InputJsonValue,
        completedAt: allDone ? (plan.completedAt ?? now) : null,
      },
    });
  }

  // ───────────────────────────── selection ─────────────────────────────

  private async questionCounts(type: TestType): Promise<{ ENG: number; default: number }> {
    const bp = BLUEPRINTS[type]!;
    if (type !== 'full_mock') return bp.perSubject;
    // Full mock mirrors the real exam: read counts from exam_config when present.
    const year = new Date().getFullYear() + 1;
    const row = await this.prisma.examConfig.findFirst({
      where: { key: 'question_counts', year: { in: [year, year - 1] } },
      orderBy: { year: 'desc' },
    });
    const v = row?.value as { ENG?: number; default?: number } | undefined;
    return { ENG: v?.ENG ?? bp.perSubject.ENG, default: v?.default ?? bp.perSubject.default };
  }

  /** Topic-proportional selection preferring questions the student hasn't seen. */
  private async pickForSubject(userId: string, code: string, count: number): Promise<string[]> {
    const topics = await this.prisma.topic.findMany({
      where: { subject: { code } },
      select: {
        id: true,
        weight: true,
        _count: { select: { questions: { where: { status: 'live' } } } },
      },
    });
    const alloc = allocateByWeight(
      count,
      topics.map((t) => ({ id: t.id, weight: Number(t.weight), available: t._count.questions })),
    );
    const picked: string[] = [];
    for (const [topicId, n] of alloc) {
      if (n > 0) picked.push(...(await this.pickFromTopic(userId, topicId, n)));
    }
    return shuffle(picked);
  }

  private async pickFromTopic(userId: string, topicId: string, count: number): Promise<string[]> {
    const live = await this.prisma.question.findMany({
      where: { topicId, status: 'live' },
      select: { id: true },
    });
    const seen = new Set(
      (
        await this.prisma.testItem.findMany({
          where: { test: { userId }, question: { topicId } },
          select: { questionId: true },
        })
      ).map((s) => s.questionId),
    );
    const fresh = shuffle(live.filter((q) => !seen.has(q.id)));
    const reused = shuffle(live.filter((q) => seen.has(q.id)));
    return [...fresh, ...reused].slice(0, count).map((q) => q.id);
  }

  // ───────────────────────────── helpers ─────────────────────────────

  async studentSubjects(userId: string): Promise<string[]> {
    const rows = await this.prisma.studentSubject.findMany({
      where: { userId },
      include: { subject: true },
    });
    return rows
      .map((r) => r.subject.code)
      .sort((a, b) => (a === 'ENG' ? -1 : b === 'ENG' ? 1 : a.localeCompare(b)));
  }

  private async freePracticeUsedToday(userId: string): Promise<number> {
    const start = lagosDate();
    const startUtc = new Date(start.getTime() - 60 * 60 * 1000); // Lagos midnight in UTC
    return this.prisma.testItem.count({
      where: { test: { userId, type: 'practice', startedAt: { gte: startUtc } } },
    });
  }

  private async assertFreeMock(userId: string) {
    const monthAgo = new Date(Date.now() - 30 * DAY);
    const used = await this.prisma.test.count({
      where: { userId, type: { in: ['mini_mock', 'full_mock'] }, startedAt: { gte: monthAgo } },
    });
    if (used >= FREE_TIER.mocksPerMonth) {
      this.paywall('Free plan includes 1 mock a month. Get the Season Pass for weekly mocks.');
    }
  }

  private paywall(message: string): never {
    throw new ApiError(HttpStatus.PAYMENT_REQUIRED, 'PAYWALL', message);
  }

  private async owned(userId: string, testId: string): Promise<Test> {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test || test.userId !== userId)
      throw new ApiError(HttpStatus.NOT_FOUND, 'TEST_NOT_FOUND', 'Test not found.');
    return test;
  }

  private assertOpen(test: Test) {
    if (test.submittedAt)
      throw new ApiError(HttpStatus.CONFLICT, 'ALREADY_SUBMITTED', 'This test has been submitted.');
  }
}
