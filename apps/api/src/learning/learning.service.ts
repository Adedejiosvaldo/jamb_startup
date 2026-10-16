import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntitlementsService } from '../commerce/entitlements.service';
import { addDays, daysBetween, lagosDate, lagosWeekday } from '../common/time';
import { buildDailyPlan, PlanItem } from '../engine/plan';
import { PrismaService } from '../prisma/prisma.service';
import { TestsService } from '../tests/tests.service';

export function masteryLabel(
  m: number,
  attempts: number,
): 'not_started' | 'weak' | 'getting_there' | 'strong' {
  if (attempts === 0) return 'not_started';
  if (m < 0.5) return 'weak';
  if (m < 0.75) return 'getting_there';
  return 'strong';
}

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly tests: TestsService,
  ) {}

  /** F-PRAC-01: today's plan, generated once per Lagos day and then kept stable. */
  async today(userId: string) {
    const date = lagosDate();
    const existing = await this.prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date } },
    });
    const paid = await this.entitlements.isPaid(userId);
    if (existing) {
      const items = existing.items as unknown as PlanItem[];
      // Re-evaluate locks if the student paid after the plan was made.
      const fresh = items.map((i) => ({ ...i, locked: paid ? false : i.locked }));
      return {
        date: existing.date,
        items: fresh,
        minutesPlanned: existing.minutesPlanned,
        completedAt: existing.completedAt,
      };
    }

    const [user, profile, subjects, firstPlan, dueReviewCount] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.studentProfile.findUnique({ where: { userId } }),
      this.tests.studentSubjects(userId),
      this.prisma.dailyPlan.findFirst({ where: { userId }, orderBy: { date: 'asc' } }),
      this.prisma.reviewQueueItem.count({
        where: { userId, dueAt: { lte: new Date() }, question: { status: 'live' } },
      }),
    ]);
    const hasDiagnostic =
      (await this.prisma.test.count({
        where: {
          userId,
          submittedAt: { not: null },
          type: { in: ['diagnostic', 'short_diagnostic', 'mini_mock', 'full_mock'] },
        },
      })) > 0;
    const examDate = user.examYear ? await this.entitlements.examDate(user.examYear) : null;

    const topics = await this.prisma.topic.findMany({
      where: { subject: { code: { in: subjects } } },
      include: {
        subject: true,
        mastery: { where: { userId } },
        _count: { select: { questions: { where: { status: 'live' } } } },
      },
    });
    const daysSinceSubject: Record<string, number> = {};
    for (const t of topics) {
      const last = t.mastery[0]?.lastPractisedAt;
      if (!last) continue;
      const d = daysBetween(last, new Date());
      const code = t.subject.code;
      daysSinceSubject[code] = Math.min(daysSinceSubject[code] ?? Infinity, d);
    }

    const items = buildDailyPlan({
      paid,
      hasDiagnostic,
      weekday: lagosWeekday(),
      daysToExam: examDate ? daysBetween(date, examDate) : null,
      dailyMinutes: profile?.dailyMinutes ?? 40,
      dueReviewCount,
      topics: topics.map((t) => ({
        id: t.id,
        name: t.name,
        subjectCode: t.subject.code,
        weight: Number(t.weight),
        learnability: Number(t.learnability),
        mastery: t.mastery[0] ? Number(t.mastery[0].mastery) : 0,
        available: t._count.questions,
      })),
      daysSinceSubject,
      planAgeDays: firstPlan ? daysBetween(firstPlan.date, date) : 0,
      subjects,
    });
    const minutesPlanned = items.filter((i) => !i.locked).reduce((s, i) => s + i.estMinutes, 0);
    const plan = await this.prisma.dailyPlan.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date, items: items as unknown as Prisma.InputJsonValue, minutesPlanned },
    });
    return { date: plan.date, items, minutesPlanned, completedAt: plan.completedAt };
  }

  async completeItem(userId: string, itemId: string) {
    const date = lagosDate();
    const plan = await this.prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date } },
    });
    if (!plan) return this.today(userId);
    const now = new Date().toISOString();
    const items = (plan.items as unknown as PlanItem[]).map((i) =>
      i.id === itemId && !i.completedAt ? { ...i, completedAt: now } : i,
    );
    const allDone = items.filter((i) => !i.locked).every((i) => i.completedAt);
    await this.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: {
        items: items as unknown as Prisma.InputJsonValue,
        completedAt: allDone ? (plan.completedAt ?? new Date()) : null,
      },
    });
    return this.today(userId);
  }

  async reviewDue(userId: string) {
    const now = new Date();
    const [due, upcoming] = await Promise.all([
      this.prisma.reviewQueueItem.count({
        where: { userId, dueAt: { lte: now }, question: { status: 'live' } },
      }),
      this.prisma.reviewQueueItem.findFirst({
        where: { userId, dueAt: { gt: now } },
        orderBy: { dueAt: 'asc' },
      }),
    ]);
    const total = await this.prisma.reviewQueueItem.count({ where: { userId } });
    return { due, total, nextDueAt: upcoming?.dueAt ?? null };
  }

  async predictions(userId: string) {
    const rows = await this.prisma.prediction.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return rows.map((p) => this.tests.presentPrediction(p));
  }

  async latestPrediction(userId: string) {
    const p = await this.prisma.prediction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return p ? this.tests.presentPrediction(p) : null;
  }

  /** F-PROG-01/02/05: streak, minutes, mastery map, countdown, target gap. */
  async progress(userId: string) {
    const today = lagosDate();
    const [user, profile, days, subjects, latest] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.studentProfile.findUnique({ where: { userId } }),
      this.prisma.activityDay.findMany({
        where: { userId, date: { gte: addDays(today, -60) } },
        orderBy: { date: 'desc' },
      }),
      this.tests.studentSubjects(userId),
      this.latestPrediction(userId),
    ]);

    // Streak: consecutive active days ending today (or yesterday if not yet studied today).
    const active = new Set(
      days.filter((d) => d.questionsAnswered > 0).map((d) => d.date.toISOString().slice(0, 10)),
    );
    let cursor = active.has(today.toISOString().slice(0, 10)) ? today : addDays(today, -1);
    let streak = 0;
    while (active.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    const weekAgo = addDays(today, -6);
    const week = days.filter((d) => d.date >= weekAgo);

    const topics = await this.prisma.topic.findMany({
      where: { subject: { code: { in: subjects } } },
      include: { subject: true, mastery: { where: { userId } } },
      orderBy: [{ weight: 'desc' }, { name: 'asc' }],
    });
    const masteryMap = subjects.map((code) => ({
      subjectCode: code,
      topics: topics
        .filter((t) => t.subject.code === code)
        .map((t) => {
          const m = t.mastery[0];
          const value = m ? Number(m.mastery) : 0;
          return {
            topicId: t.id,
            name: t.name,
            weight: Number(t.weight),
            mastery: value,
            attempts: m?.attempts ?? 0,
            label: masteryLabel(value, m?.attempts ?? 0),
          };
        }),
    }));

    const examDate = user.examYear ? await this.entitlements.examDate(user.examYear) : null;
    return {
      streak,
      today: days.find((d) => d.date.getTime() === today.getTime()) ?? {
        minutes: 0,
        questionsAnswered: 0,
      },
      week: {
        daysActive: week.filter((d) => d.questionsAnswered > 0).length,
        minutes: week.reduce((s, d) => s + d.minutes, 0),
        questions: week.reduce((s, d) => s + d.questionsAnswered, 0),
      },
      exam: {
        year: user.examYear,
        date: examDate,
        daysLeft: examDate ? Math.max(0, daysBetween(today, examDate)) : null,
      },
      target: profile?.targetScore ?? null,
      prediction: latest,
      gap: latest && profile?.targetScore ? Math.max(0, profile.targetScore - latest.mid) : null,
      masteryMap,
    };
  }
}
