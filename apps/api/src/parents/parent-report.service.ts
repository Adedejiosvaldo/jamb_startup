import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../auth/auth.errors';
import { AuditService } from '../common/audit.service';
import { addDays, lagosDate } from '../common/time';
import { ENV, Env } from '../config/env';
import { waLink } from '../messaging/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ParentReport {
  studentFirstName: string;
  week: { daysActive: number; minutes: number; questions: number };
  prediction: {
    previous: number | null;
    latest: number | null;
    low: number | null;
    high: number | null;
  };
  biggestImprovement: string | null;
  target: { course: string | null; university: string | null; score: number | null };
  message: string;
}

const hm = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;

/** F-PAR-02 weekly report (manual send first) and F-PAR-04 token page. */
@Injectable()
export class ParentReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async build(studentId: string): Promise<ParentReport> {
    const today = lagosDate();
    const weekStart = addDays(today, -6);
    const [user, profile, days, predictions] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: studentId } }),
      this.prisma.studentProfile.findUnique({
        where: { userId: studentId },
        include: { targetCourse: true, targetUniversity: true },
      }),
      this.prisma.activityDay.findMany({ where: { userId: studentId, date: { gte: weekStart } } }),
      this.prisma.prediction.findMany({
        where: { userId: studentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const latest = predictions[0] ?? null;
    const weekAgo = addDays(new Date(), -7);
    const previous =
      predictions.find((p) => p.createdAt <= weekAgo) ??
      predictions[predictions.length - 1] ??
      null;

    // Biggest improvement: topic whose accuracy this week beat its earlier accuracy by the most.
    const items = await this.prisma.testItem.findMany({
      where: {
        test: { userId: studentId, submittedAt: { not: null } },
        isCorrect: { not: null },
        answeredAt: { gte: addDays(today, -35) },
      },
      select: {
        isCorrect: true,
        answeredAt: true,
        question: {
          select: {
            topic: { select: { id: true, name: true, subject: { select: { name: true } } } },
          },
        },
      },
    });
    const stats = new Map<
      string,
      { label: string; nowC: number; nowN: number; beforeC: number; beforeN: number }
    >();
    for (const i of items) {
      const t = i.question.topic;
      const s = stats.get(t.id) ?? {
        label: `${t.subject.name} – ${t.name}`,
        nowC: 0,
        nowN: 0,
        beforeC: 0,
        beforeN: 0,
      };
      if (i.answeredAt && i.answeredAt >= weekStart) {
        s.nowN += 1;
        s.nowC += i.isCorrect ? 1 : 0;
      } else {
        s.beforeN += 1;
        s.beforeC += i.isCorrect ? 1 : 0;
      }
      stats.set(t.id, s);
    }
    let best: { label: string; delta: number } | null = null;
    for (const s of stats.values()) {
      if (s.nowN < 3 || s.beforeN < 3) continue;
      const delta = s.nowC / s.nowN - s.beforeC / s.beforeN;
      if (delta > 0.05 && (!best || delta > best.delta)) best = { label: s.label, delta };
    }

    const first = user.name?.split(' ')[0] ?? 'Your child';
    const week = {
      daysActive: days.filter((d) => d.questionsAnswered > 0).length,
      minutes: days.reduce((s, d) => s + d.minutes, 0),
      questions: days.reduce((s, d) => s + d.questionsAnswered, 0),
    };
    const target = {
      course: profile?.targetCourse?.name ?? null,
      university: profile?.targetUniversity?.shortName ?? profile?.targetUniversity?.name ?? null,
      score: profile?.targetScore ?? null,
    };

    const lines = [
      `Good evening! Here's ${first}'s JAMB week: studied ${week.daysActive} of 7 days (${hm(week.minutes)}), ${week.questions} questions.`,
    ];
    if (latest) {
      lines.push(
        previous && previous.id !== latest.id
          ? `Predicted score: ${previous.totalMid} → ${latest.totalMid} (${latest.totalMid - previous.totalMid >= 0 ? '+' : ''}${latest.totalMid - previous.totalMid}).`
          : `Predicted score: about ${latest.totalMid} (range ${latest.totalLow}–${latest.totalHigh}).`,
      );
    }
    if (best) lines.push(`Biggest improvement: ${best.label}.`);
    if (target.course && target.score)
      lines.push(
        `Target for ${target.course}${target.university ? ` at ${target.university}` : ''}: ${target.score}+.`,
      );
    lines.push(
      week.daysActive >= 4
        ? "A quick 'well done' goes a long way."
        : 'A little encouragement to study daily this week will help.',
    );
    if (this.env.SUPPORT_WHATSAPP) lines.push(`Questions? WhatsApp ${this.env.SUPPORT_WHATSAPP}.`);
    lines.push('Reply STOP to stop these messages.');

    return {
      studentFirstName: first,
      week,
      prediction: {
        previous: previous?.totalMid ?? null,
        latest: latest?.totalMid ?? null,
        low: latest?.totalLow ?? null,
        high: latest?.totalHigh ?? null,
      },
      biggestImprovement: best?.label ?? null,
      target,
      message: lines.join(' '),
    };
  }

  /** Opted-in parents not messaged in the last 6 days. */
  async due() {
    const cutoff = addDays(new Date(), -6);
    const links = await this.prisma.parentLink.findMany({
      where: {
        optedInAt: { not: null },
        optedOutAt: null,
        OR: [{ lastReportSentAt: null }, { lastReportSentAt: { lt: cutoff } }],
      },
      include: { student: { select: { id: true, name: true, phone: true } } },
      take: 200,
    });
    return Promise.all(
      links.map(async (l) => {
        const report = await this.build(l.studentId);
        const pageUrl = `${this.env.WEB_URL}/p/${l.reportToken}`;
        const text = `${report.message} Full report: ${pageUrl}`;
        return {
          linkId: l.id,
          student: l.student,
          parentPhone: l.parentPhone,
          lastReportSentAt: l.lastReportSentAt,
          report,
          text,
          whatsappUrl: waLink(l.parentPhone, text),
        };
      }),
    );
  }

  async markSent(actorId: string, linkId: string) {
    const link = await this.prisma.parentLink.findUniqueOrThrow({ where: { id: linkId } });
    const report = await this.build(link.studentId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.parentLink.update({ where: { id: linkId }, data: { lastReportSentAt: now } }),
      this.prisma.messageLog.create({
        data: {
          userId: link.studentId,
          phone: link.parentPhone,
          channel: 'whatsapp',
          template: 'weekly_report',
          payload: { text: report.message },
          status: 'sent',
          sentAt: now,
        },
      }),
      this.prisma.event.create({
        data: { userId: link.studentId, name: 'parent_report_sent', props: { linkId } },
      }),
    ]);
    await this.audit.record(actorId, 'send', 'parent_report', linkId, null, { at: now });
    return { sent: true };
  }

  // ───── public token endpoints ─────

  async linkInfo(token: string) {
    const link = await this.byToken(token);
    const student = await this.prisma.user.findUniqueOrThrow({ where: { id: link.studentId } });
    return {
      studentFirstName: student.name?.split(' ')[0] ?? null,
      optedIn: !!link.optedInAt && !link.optedOutAt,
      optedOut: !!link.optedOutAt,
    };
  }

  async optIn(token: string) {
    const link = await this.byToken(token);
    await this.prisma.parentLink.update({
      where: { id: link.id },
      data: { optedInAt: new Date(), optedOutAt: null },
    });
    await this.prisma.event.create({
      data: { userId: link.studentId, name: 'parent_opted_in', props: {} },
    });
    return { optedIn: true };
  }

  async optOut(token: string) {
    const link = await this.byToken(token);
    await this.prisma.parentLink.update({
      where: { id: link.id },
      data: { optedOutAt: new Date() },
    });
    return { optedOut: true };
  }

  async publicReport(token: string) {
    const link = await this.byToken(token);
    if (!link.optedInAt || link.optedOutAt) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'NOT_OPTED_IN', 'Agree to receive reports first.');
    }
    const { message: _m, ...report } = await this.build(link.studentId);
    const history = await this.prisma.prediction.findMany({
      where: { userId: link.studentId },
      orderBy: { createdAt: 'asc' },
      take: 30,
      select: { totalLow: true, totalMid: true, totalHigh: true, createdAt: true },
    });
    return { ...report, history };
  }

  private async byToken(token: string) {
    const link = await this.prisma.parentLink.findUnique({ where: { reportToken: token } });
    if (!link)
      throw new ApiError(HttpStatus.NOT_FOUND, 'LINK_NOT_FOUND', 'This link is not valid.');
    return link;
  }
}
