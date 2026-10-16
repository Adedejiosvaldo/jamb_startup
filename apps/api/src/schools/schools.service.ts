import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../auth/auth.errors';
import { AuditService } from '../common/audit.service';
import { ENV, Env } from '../config/env';
import { predict } from '../engine/prediction';
import { allocateByWeight, shuffle } from '../engine/selection';
import { PrismaService } from '../prisma/prisma.service';

export interface Paper {
  subjects: { code: string; questionIds: string[] }[];
}

interface EntryResult {
  subjects: { code: string; correct: number; total: number; scaled: number }[];
  predicted: { low: number; mid: number; high: number; status: string } | null;
  weakTopics: { subjectCode: string; name: string; accuracy: number }[];
}

const BUCKETS = [
  { label: 'Below 150', max: 149 },
  { label: '150–199', max: 199 },
  { label: '200–249', max: 249 },
  { label: '250–299', max: 299 },
  { label: '300+', max: 400 },
];

/** F-SCH-01..03: paper mock day — paper, fast answer entry, class and individual reports. */
@Injectable()
export class SchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async createEvent(
    actorId: string,
    schoolId: string,
    input: {
      date: Date;
      type: 'paper_mock' | 'lab_mock';
      name?: string;
      subjects: string[];
      perSubject: number;
      couponCode?: string;
    },
  ) {
    const paper: Paper = { subjects: [] };
    for (const code of input.subjects) {
      const topics = await this.prisma.topic.findMany({
        where: { subject: { code } },
        select: {
          id: true,
          weight: true,
          _count: { select: { questions: { where: { status: 'live' } } } },
        },
      });
      const alloc = allocateByWeight(
        input.perSubject,
        topics.map((t) => ({ id: t.id, weight: Number(t.weight), available: t._count.questions })),
      );
      const ids: string[] = [];
      for (const [topicId, n] of alloc) {
        if (!n) continue;
        const qs = await this.prisma.question.findMany({
          where: { topicId, status: 'live' },
          select: { id: true },
        });
        ids.push(
          ...shuffle(qs)
            .slice(0, n)
            .map((q) => q.id),
        );
      }
      if (!ids.length)
        throw new ApiError(HttpStatus.CONFLICT, 'NO_QUESTIONS', `No live questions for ${code}.`);
      paper.subjects.push({ code, questionIds: shuffle(ids) });
    }
    const event = await this.prisma.schoolEvent.create({
      data: {
        schoolId,
        date: input.date,
        type: input.type,
        name: input.name,
        couponCode: input.couponCode?.toUpperCase(),
        paper: paper as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.record(actorId, 'create', 'school_event', event.id, null, event);
    return event;
  }

  /** Printable paper with answer key (keep the key page separate when printing). */
  async event(id: string) {
    const event = await this.prisma.schoolEvent.findUnique({
      where: { id },
      include: { school: true, entries: { orderBy: { studentName: 'asc' } } },
    });
    if (!event) throw new ApiError(HttpStatus.NOT_FOUND, 'EVENT_NOT_FOUND', 'Event not found.');
    const paper = (event.paper as unknown as Paper | null) ?? { subjects: [] };
    const allIds = paper.subjects.flatMap((s) => s.questionIds);
    const questions = new Map(
      (
        await this.prisma.question.findMany({
          where: { id: { in: allIds } },
          include: { topic: true },
        })
      ).map((q) => [q.id, q]),
    );
    const subjects = await this.prisma.subject.findMany({
      where: { code: { in: paper.subjects.map((s) => s.code) } },
    });
    return {
      ...event,
      paper: paper.subjects.map((s) => ({
        code: s.code,
        name: subjects.find((x) => x.code === s.code)?.name ?? s.code,
        questions: s.questionIds.map((qid, i) => {
          const q = questions.get(qid)!;
          return {
            number: i + 1,
            id: q.id,
            stem: q.stem,
            options: q.options,
            correctOption: q.correctOption,
            topic: q.topic.name,
          };
        }),
      })),
    };
  }

  /** Answers are typed as one string per subject, e.g. "ABDC-AB…" ('-' or ' ' = blank). */
  async addEntry(
    actorId: string,
    eventId: string,
    input: {
      studentName: string;
      className?: string;
      parentPhone?: string | null;
      answers: Record<string, string>;
    },
  ) {
    const event = await this.prisma.schoolEvent.findUniqueOrThrow({ where: { id: eventId } });
    const paper = event.paper as unknown as Paper;
    const answers: Record<string, string> = {};
    for (const [code, raw] of Object.entries(input.answers)) {
      const subject = paper.subjects.find((s) => s.code === code);
      if (!subject)
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'UNKNOWN_SUBJECT',
          `${code} is not on this paper.`,
        );
      const clean = raw.toUpperCase().replace(/[^ABCD\- ]/g, '');
      if (clean.length > subject.questionIds.length) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'TOO_MANY_ANSWERS',
          `${code} has ${subject.questionIds.length} questions but ${clean.length} answers were entered.`,
        );
      }
      answers[code] = clean.padEnd(subject.questionIds.length, '-');
    }
    const result = await this.score(paper, answers);
    const row = await this.prisma.schoolEventEntry.create({
      data: {
        eventId,
        studentName: input.studentName.trim(),
        className: input.className,
        parentPhone: input.parentPhone ?? null,
        answers,
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.record(actorId, 'create', 'school_event_entry', row.id, null, {
      eventId,
      studentName: row.studentName,
    });
    return row;
  }

  async deleteEntry(actorId: string, entryId: string) {
    const row = await this.prisma.schoolEventEntry.delete({ where: { id: entryId } });
    await this.audit.record(actorId, 'delete', 'school_event_entry', entryId, row, null);
  }

  /** F-SCH-02: class readiness report. */
  async classReport(eventId: string) {
    const event = await this.event(eventId);
    const entries = event.entries.map((e) => ({
      ...e,
      result: e.result as unknown as EntryResult,
    }));
    const predicted = entries
      .map((e) => e.result.predicted?.mid)
      .filter((v): v is number => typeof v === 'number');
    const distribution = BUCKETS.map((b, i) => ({
      label: b.label,
      count: predicted.filter((v) => v <= b.max && v > (i === 0 ? -1 : BUCKETS[i - 1]!.max)).length,
    }));

    const subjects = event.paper.map((s) => {
      const scores = entries
        .map((e) => e.result.subjects.find((x) => x.code === s.code))
        .filter((x): x is NonNullable<typeof x> => !!x);
      // Topic accuracy across the class.
      const topicStats = new Map<string, { correct: number; total: number }>();
      for (const e of entries) {
        const ans = e.answers as Record<string, string>;
        const line = ans[s.code];
        if (!line) continue;
        s.questions.forEach((q, i) => {
          const t = topicStats.get(q.topic) ?? { correct: 0, total: 0 };
          t.total += 1;
          t.correct += line[i] === q.correctOption ? 1 : 0;
          topicStats.set(q.topic, t);
        });
      }
      return {
        code: s.code,
        name: s.name,
        students: scores.length,
        averageScaled: scores.length
          ? Math.round(scores.reduce((sum, x) => sum + x.scaled, 0) / scores.length)
          : null,
        weakestTopics: [...topicStats.entries()]
          .map(([name, t]) => ({ name, accuracy: t.total ? t.correct / t.total : 0 }))
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 3),
      };
    });

    const avg = predicted.length
      ? Math.round(predicted.reduce((a, b) => a + b, 0) / predicted.length)
      : null;
    const below200 = predicted.filter((v) => v < 200).length;
    const recommendations = [
      ...subjects
        .filter((s) => s.weakestTopics[0])
        .map(
          (s) =>
            `${s.name}: spend extra class time on ${s.weakestTopics.map((t) => t.name).join(', ')}.`,
        ),
      below200
        ? `${below200} of ${predicted.length} students are predicted below 200 — they need a structured daily plan now.`
        : null,
      'CBT readiness: give every student at least two timed practice sessions on a computer before the exam.',
    ].filter((x): x is string => !!x);

    return {
      event: { id: event.id, name: event.name, date: event.date, type: event.type },
      school: { name: event.school.name, lga: event.school.lga, state: event.school.state },
      students: entries.length,
      averagePredicted: avg,
      distribution,
      subjects,
      recommendations,
      note: 'Predicted ranges come from a short paper mock and are wide. They are estimates, not guarantees. ScoreCoach is not affiliated with JAMB.',
    };
  }

  /** F-SCH-03: one student's report with the offer link. */
  async entryReport(entryId: string) {
    const entry = await this.prisma.schoolEventEntry.findUnique({
      where: { id: entryId },
      include: { event: { include: { school: true } } },
    });
    if (!entry) throw new ApiError(HttpStatus.NOT_FOUND, 'ENTRY_NOT_FOUND', 'Entry not found.');
    const coupon = entry.event.couponCode;
    return {
      studentName: entry.studentName,
      className: entry.className,
      school: entry.event.school.name,
      date: entry.event.date,
      result: entry.result,
      offerUrl: `${this.env.WEB_URL}/start${coupon ? `?coupon=${encodeURIComponent(coupon)}` : ''}`,
      couponCode: coupon,
    };
  }

  private async score(paper: Paper, answers: Record<string, string>): Promise<EntryResult> {
    const ids = paper.subjects.flatMap((s) => s.questionIds);
    const qs = new Map(
      (
        await this.prisma.question.findMany({
          where: { id: { in: ids } },
          include: { topic: true },
        })
      ).map((q) => [q.id, q]),
    );
    const topics = await this.prisma.topic.findMany({
      where: { subject: { code: { in: Object.keys(answers) } } },
      include: { subject: true },
    });
    const now = new Date();
    const subjects: EntryResult['subjects'] = [];
    const weak = new Map<
      string,
      { subjectCode: string; name: string; correct: number; total: number }
    >();
    const input = Object.entries(answers).map(([code, line]) => {
      const subject = paper.subjects.find((s) => s.code === code)!;
      let correct = 0;
      const items = subject.questionIds.map((qid, i) => {
        const q = qs.get(qid)!;
        const ok = line[i] === q.correctOption;
        if (ok) correct += 1;
        const w = weak.get(q.topicId) ?? {
          subjectCode: code,
          name: q.topic.name,
          correct: 0,
          total: 0,
        };
        w.total += 1;
        w.correct += ok ? 1 : 0;
        weak.set(q.topicId, w);
        return {
          topicId: q.topicId,
          correct: ok,
          difficulty: q.difficulty,
          answeredAt: now,
          timed: false,
        };
      });
      subjects.push({
        code,
        correct,
        total: items.length,
        scaled: Math.round((100 * correct) / items.length),
      });
      return {
        code,
        topics: topics
          .filter((t) => t.subject.code === code)
          .map((t) => ({ id: t.id, weight: Number(t.weight) })),
        items,
      };
    });
    const p = input.length === 4 ? predict(input) : null;
    return {
      subjects,
      predicted: p?.total ? { ...p.total, status: p.status } : null,
      weakTopics: [...weak.values()]
        .filter((w) => w.total >= 2)
        .map((w) => ({ subjectCode: w.subjectCode, name: w.name, accuracy: w.correct / w.total }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 3),
    };
  }
}
