import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../auth/auth.errors';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { Staff } from '../auth/staff.guard';
import { AuditService } from '../common/audit.service';
import { addDays, lagosDate } from '../common/time';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { PrismaService } from '../prisma/prisma.service';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function code(len: number, prefix = ''): string {
  const bytes = randomBytes(len);
  return prefix + [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

@Injectable()
export class TeacherGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: req.auth.userId } });
    if (!teacher?.verifiedAt) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'TEACHER_NOT_VERIFIED',
        'Your teacher account is waiting for verification.',
      );
    }
    return true;
  }
}

/** F-TCH-01..05: lesson-teacher affiliate dashboard. */
@Controller('v1/teacher')
@UseGuards(AuthGuard)
export class TeacherController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('apply')
  async apply(
    @Req() req: AuthedRequest,
    @Body(
      new ZodBodyPipe(
        z.object({ name: z.string().trim().min(2), about: z.string().max(1000).optional() }),
      ),
    )
    body: { name: string; about?: string },
  ) {
    const userId = req.auth.userId;
    await this.prisma.user.update({ where: { id: userId }, data: { name: body.name } });
    const existing = await this.prisma.teacher.findUnique({ where: { userId } });
    if (existing)
      return {
        status: existing.verifiedAt ? 'verified' : 'pending',
        referralCode: existing.referralCode,
      };
    // [DECIDE] commission between 20–30% (spec §20); admin sets the final value on verification.
    const teacher = await this.prisma.teacher.create({
      data: { userId, referralCode: code(6, 'T'), commissionPct: 20 },
    });
    await this.prisma.supportTicket.create({
      data: {
        userId,
        channel: 'in_app',
        category: 'other',
        body: `Teacher application: ${body.name}. ${body.about ?? ''}`.trim(),
        context: { kind: 'teacher_application' },
      },
    });
    return { status: 'pending', referralCode: teacher.referralCode };
  }

  @Get('me')
  async me(@Req() req: AuthedRequest) {
    const t = await this.prisma.teacher.findUnique({
      where: { userId: req.auth.userId },
      include: { coupons: true },
    });
    if (!t) return { status: 'none' };
    return {
      status: t.verifiedAt ? 'verified' : 'pending',
      referralCode: t.referralCode,
      commissionPct: Number(t.commissionPct),
      coupon: t.coupons[0]
        ? { code: t.coupons[0].code, percentOff: t.coupons[0].percentOff }
        : null,
    };
  }

  @Get('classes')
  @UseGuards(TeacherGuard)
  classes(@Req() req: AuthedRequest) {
    return this.prisma.class.findMany({
      where: { teacherId: req.auth.userId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('classes')
  @UseGuards(TeacherGuard)
  createClass(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(z.object({ name: z.string().trim().min(2).max(60) })))
    body: { name: string },
  ) {
    return this.prisma.class.create({
      data: { teacherId: req.auth.userId, name: body.name, joinCode: code(6) },
    });
  }

  /** F-TCH-03: who's inactive, class weak topics, predicted score distribution. */
  @Get('classes/:id/overview')
  @UseGuards(TeacherGuard)
  async overview(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, teacherId: req.auth.userId },
      include: { members: { include: { student: true } } },
    });
    if (!cls) throw new ApiError(HttpStatus.NOT_FOUND, 'CLASS_NOT_FOUND', 'Class not found.');
    const ids = cls.members.map((m) => m.studentId);
    const since = addDays(lagosDate(), -6);
    const [activity, predictions, mastery] = await Promise.all([
      this.prisma.activityDay.findMany({ where: { userId: { in: ids }, date: { gte: since } } }),
      this.prisma.prediction.findMany({
        where: { userId: { in: ids } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.topicMastery.findMany({
        where: { userId: { in: ids }, attempts: { gte: 3 } },
        include: { topic: { include: { subject: true } } },
      }),
    ]);
    const latestPred = new Map<string, number>();
    for (const p of predictions)
      if (!latestPred.has(p.userId)) latestPred.set(p.userId, p.totalMid);
    const threeDaysAgo = addDays(lagosDate(), -2);
    const students = cls.members.map((m) => {
      const days = activity.filter((a) => a.userId === m.studentId && a.questionsAnswered > 0);
      return {
        id: m.studentId,
        // Child safety (spec §14): first name + initial only.
        name: displayName(m.student.name),
        daysActive: days.length,
        minutes: days.reduce((s, d) => s + d.minutes, 0),
        predicted: latestPred.get(m.studentId) ?? null,
        inactive: !days.some((d) => d.date >= threeDaysAgo),
      };
    });
    const topicAgg = new Map<string, { name: string; subject: string; sum: number; n: number }>();
    for (const tm of mastery) {
      const a = topicAgg.get(tm.topicId) ?? {
        name: tm.topic.name,
        subject: tm.topic.subject.code,
        sum: 0,
        n: 0,
      };
      a.sum += Number(tm.mastery);
      a.n += 1;
      topicAgg.set(tm.topicId, a);
    }
    return {
      class: { id: cls.id, name: cls.name, joinCode: cls.joinCode },
      students,
      inactive: students.filter((s) => s.inactive).map((s) => s.name),
      weakestTopics: [...topicAgg.values()]
        .filter((t) => t.n >= 2)
        .map((t) => ({ subjectCode: t.subject, name: t.name, mastery: t.sum / t.n, students: t.n }))
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 5),
      distribution: [
        {
          label: 'Below 200',
          count: students.filter((s) => s.predicted !== null && s.predicted < 200).length,
        },
        {
          label: '200–249',
          count: students.filter(
            (s) => s.predicted !== null && s.predicted >= 200 && s.predicted < 250,
          ).length,
        },
        {
          label: '250+',
          count: students.filter((s) => s.predicted !== null && s.predicted >= 250).length,
        },
        { label: 'No prediction yet', count: students.filter((s) => s.predicted === null).length },
      ],
    };
  }

  /** F-TCH-05. */
  @Get('earnings')
  @UseGuards(TeacherGuard)
  async earnings(@Req() req: AuthedRequest) {
    const rows = await this.prisma.commission.findMany({
      where: { teacherId: req.auth.userId },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { paidAt: true, amountKobo: true } } },
    });
    const sum = (s: string) =>
      rows.filter((r) => r.status === s).reduce((t, r) => t + r.amountKobo, 0);
    return {
      paidStudents: rows.filter((r) => r.status !== 'reversed').length,
      owedKobo: sum('owed'),
      paidKobo: sum('paid'),
      history: rows.map((r) => ({
        id: r.id,
        amountKobo: r.amountKobo,
        status: r.status,
        paidAt: r.paidAt,
        saleAt: r.order.paidAt,
      })),
    };
  }
}

function displayName(name: string | null): string {
  if (!name) return 'Student';
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first!;
}

@Controller('v1/classes')
@UseGuards(AuthGuard)
export class ClassJoinController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('join')
  @HttpCode(200)
  async join(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(z.object({ code: z.string().trim().toUpperCase() })))
    body: { code: string },
  ) {
    const cls = await this.prisma.class.findUnique({
      where: { joinCode: body.code },
      include: { teacher: { include: { user: true } } },
    });
    if (!cls)
      throw new ApiError(HttpStatus.NOT_FOUND, 'CLASS_NOT_FOUND', 'That class code is not right.');
    await this.prisma.classMember.upsert({
      where: { classId_studentId: { classId: cls.id, studentId: req.auth.userId } },
      update: {},
      create: { classId: cls.id, studentId: req.auth.userId },
    });
    await this.prisma.event.create({
      data: { userId: req.auth.userId, name: 'student_joined_class', props: { classId: cls.id } },
    });
    return { class: { name: cls.name, teacher: displayName(cls.teacher?.user.name ?? null) } };
  }
}

const verifySchema = z.object({
  commissionPct: z.number().min(0).max(50).default(20),
  /** Discount the teacher's students get with the teacher's code. */
  discountPct: z.number().int().min(0).max(50).default(10),
});

@Controller('v1/admin')
@Staff('admin')
export class TeachersAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('teachers')
  teachers() {
    return this.prisma.teacher.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true } },
        _count: { select: { classes: true, commissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('teachers/:userId/verify')
  async verify(
    @Req() req: AuthedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodBodyPipe(verifySchema)) body: z.infer<typeof verifySchema>,
  ) {
    const t = await this.prisma.teacher.update({
      where: { userId },
      data: { verifiedAt: new Date(), commissionPct: body.commissionPct },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { role: 'teacher' } });
    if (body.discountPct > 0) {
      await this.prisma.coupon.upsert({
        where: { code: t.referralCode },
        update: { percentOff: body.discountPct, ownerTeacherId: userId },
        create: { code: t.referralCode, percentOff: body.discountPct, ownerTeacherId: userId },
      });
    }
    await this.audit.record(req.auth.userId, 'verify', 'teacher', userId, null, {
      ...t,
      discountPct: body.discountPct,
    });
    return t;
  }

  @Get('commissions')
  commissions(@Query('status') status?: 'owed' | 'paid' | 'reversed') {
    return this.prisma.commission.findMany({
      where: { status: status ?? 'owed' },
      include: {
        teacher: { include: { user: { select: { name: true, phone: true } } } },
        order: { select: { paystackReference: true, paidAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Monthly payout run: mark as paid after the bank transfer. */
  @Post('commissions/mark-paid')
  @HttpCode(200)
  async markPaid(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(z.object({ ids: z.array(z.string().uuid()).min(1) })))
    body: { ids: string[] },
  ) {
    const res = await this.prisma.commission.updateMany({
      where: { id: { in: body.ids }, status: 'owed' },
      data: { status: 'paid', paidAt: new Date() },
    });
    await this.audit.record(req.auth.userId, 'payout', 'commission', null, null, {
      ids: body.ids,
      count: res.count,
    });
    return { paid: res.count };
  }
}
