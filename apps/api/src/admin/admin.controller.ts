import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { AuthedRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { Staff } from '../auth/staff.guard';
import { AuditService } from '../common/audit.service';
import { addDays, daysBetween, lagosDate } from '../common/time';
import { normaliseNigerianPhone } from '../common/phone';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';

const DAY = 24 * 60 * 60 * 1000;

@Controller('v1/admin')
@Staff('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly profile: ProfileService,
    private readonly audit: AuditService,
  ) {}

  /** Users: search by phone or name (spec §15). */
  @Get('users')
  async users(@Query('q') q = '') {
    const phone = normaliseNigerianPhone(q);
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { phone: { contains: phone ?? (q.replace(/\D/g, '') || q) } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        status: true,
        examYear: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });
  }

  @Get('users/:id')
  async user(@Param('id', ParseUUIDPipe) id: string) {
    const [me, devices, orders, tests, tickets, entitlements, parentLinks] = await Promise.all([
      this.profile.me(id),
      this.prisma.device.findMany({ where: { userId: id }, orderBy: { lastActiveAt: 'desc' } }),
      this.prisma.order.findMany({
        where: { userId: id },
        include: { product: true, refunds: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.test.findMany({
        where: { userId: id },
        orderBy: { startedAt: 'desc' },
        take: 20,
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.supportTicket.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.entitlement.findMany({
        where: { userId: id },
        include: { product: true },
        orderBy: { startsAt: 'desc' },
      }),
      this.prisma.parentLink.findMany({ where: { studentId: id } }),
    ]);
    return { ...me, devices, orders, tests, tickets, entitlements, parentLinks };
  }

  @Post('users/:id/devices/:deviceId/revoke')
  @HttpCode(200)
  async revokeDevice(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    await this.auth.revokeDevice(id, deviceId);
    await this.audit.record(req.auth.userId, 'revoke_device', 'device', deviceId, null, {
      userId: id,
    });
    return { revoked: true };
  }

  @Post('parent-links/:id/opt-out')
  @HttpCode(200)
  async parentOptOut(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const row = await this.prisma.parentLink.update({
      where: { id },
      data: { optedOutAt: new Date() },
    });
    await this.audit.record(req.auth.userId, 'opt_out', 'parent_link', id, null, row);
    return row;
  }

  /** Manual WhatsApp outbox until Cloud API templates are approved. */
  @Get('outbox')
  outbox() {
    return this.prisma.messageLog.findMany({
      where: { channel: 'whatsapp', status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  @Post('outbox/:id/mark-sent')
  @HttpCode(200)
  async outboxSent(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const row = await this.prisma.messageLog.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date() },
    });
    await this.audit.record(req.auth.userId, 'send', 'message', id, null, {
      template: row.template,
    });
    return row;
  }

  /**
   * Score-gain guarantee eligibility (spec §22). Human approves; this only computes.
   * Window: 6 weeks from purchase. Baseline: first predicting test after purchase.
   * Eligible: plan completion ≥ 80% of days AND ≥ 4 weekly mini-mocks.
   */
  @Get('users/:id/guarantee')
  async guarantee(@Param('id', ParseUUIDPipe) id: string) {
    const paid = await this.prisma.order.findFirst({
      where: { userId: id, status: 'paid' },
      orderBy: { paidAt: 'asc' },
    });
    if (!paid?.paidAt) return { applicable: false, reason: 'No paid order.' };
    const start = paid.paidAt;
    const end = new Date(start.getTime() + 42 * DAY);
    const [preds, plans, mocks] = await Promise.all([
      this.prisma.prediction.findMany({
        where: { userId: id, createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dailyPlan.findMany({
        where: { userId: id, date: { gte: lagosDate(start), lte: lagosDate(end) } },
      }),
      this.prisma.test.count({
        where: { userId: id, type: 'mini_mock', submittedAt: { gte: start, lte: end } },
      }),
    ]);
    const baseline = preds[0] ?? null;
    const latest = preds[preds.length - 1] ?? null;
    const daysElapsed = Math.max(
      1,
      Math.min(42, daysBetween(lagosDate(start), lagosDate(new Date()))),
    );
    const completedDays = plans.filter((p) => p.completedAt).length;
    const completionPct = Math.round((100 * completedDays) / daysElapsed);
    const gain = baseline && latest ? latest.totalMid - baseline.totalMid : null;
    const sameEngine = !!baseline && !!latest && baseline.engineVersion === latest.engineVersion;
    const eligible = completionPct >= 80 && mocks >= 4 && sameEngine;
    return {
      applicable: true,
      window: { start, end, complete: new Date() >= end },
      baseline: baseline && {
        mid: baseline.totalMid,
        at: baseline.createdAt,
        engine: baseline.engineVersion,
      },
      latest: latest && {
        mid: latest.totalMid,
        at: latest.createdAt,
        engine: latest.engineVersion,
      },
      gain,
      planCompletionPct: completionPct,
      miniMocks: mocks,
      eligible,
      /** [DECIDE] public threshold after pilot data; 30 is the spec's working number. */
      refundDue: eligible && gain !== null && gain < 30,
      orderId: paid.id,
    };
  }

  /** One-screen numbers for the Sunday review (spec §16, §27). */
  @Get('metrics')
  async metrics() {
    const since = addDays(new Date(), -30);
    const weekAgo = addDays(new Date(), -7);
    const names = [
      'landing_viewed',
      'checker_used',
      'diagnostic_started',
      'mock_completed',
      'paywall_viewed',
      'checkout_started',
      'payment_succeeded',
    ];
    const counts = await this.prisma.event.groupBy({
      by: ['name'],
      where: { ts: { gte: since }, name: { in: names } },
      _count: { _all: true },
    });
    const funnel = Object.fromEntries(
      names.map((n) => [n, counts.find((c) => c.name === n)?._count._all ?? 0]),
    );
    const [revenue, refunds, wau, paidUsers, reportsOpen, ticketsOpen] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: 'paid', paidAt: { gte: since } },
        _sum: { amountKobo: true },
        _count: true,
      }),
      this.prisma.refund.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { amountKobo: true },
        _count: true,
      }),
      this.prisma.activityDay.groupBy({
        by: ['userId'],
        where: { date: { gte: lagosDate(weekAgo) }, questionsAnswered: { gt: 0 } },
      }),
      this.prisma.entitlement.count({ where: { revokedAt: null, endsAt: { gt: new Date() } } }),
      this.prisma.questionReport.count({ where: { status: 'open' } }),
      this.prisma.supportTicket.count({ where: { status: { in: ['open', 'pending'] } } }),
    ]);
    return {
      funnel30d: funnel,
      revenue30d: { kobo: revenue._sum.amountKobo ?? 0, orders: revenue._count },
      refunds30d: { kobo: refunds._sum.amountKobo ?? 0, count: refunds._count },
      weeklyActiveStudents: wau.length,
      activePaidStudents: paidUsers,
      openQuestionReports: reportsOpen,
      openTickets: ticketsOpen,
    };
  }
}
