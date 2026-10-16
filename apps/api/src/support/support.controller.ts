import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthedRequest } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { Staff } from '../auth/staff.guard';
import { AuditService } from '../common/audit.service';
import { normaliseNigerianPhone } from '../common/phone';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { PrismaService } from '../prisma/prisma.service';

const ticketSchema = z.object({
  category: z.enum(['payment', 'access', 'otp', 'content', 'exam', 'refund', 'other']),
  body: z.string().trim().min(3).max(4000),
  phone: z.string().optional(),
  /** F-SUP-02 auto-attached context: last screen, app version, device. */
  context: z.record(z.unknown()).default({}),
});

const ticketPatch = z.object({
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

/** Spec §18: payment issues first, then access, then content. */
const PRIORITY: Record<string, number> = {
  payment: 0,
  refund: 0,
  access: 1,
  otp: 1,
  exam: 1,
  content: 2,
  other: 3,
};
const SLA_MS = 12 * 60 * 60 * 1000;

@Controller('v1/support')
export class SupportController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('tickets')
  @UseGuards(OptionalAuthGuard)
  async create(
    @Req() req: Partial<AuthedRequest>,
    @Body(new ZodBodyPipe(ticketSchema)) body: z.infer<typeof ticketSchema>,
  ) {
    const userId = req.auth?.userId ?? null;
    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
    const phone = user?.phone ?? (body.phone ? normaliseNigerianPhone(body.phone) : null);
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        phone,
        channel: 'in_app',
        category: body.category,
        body: body.body,
        context: {
          ...body.context,
          userAgent: req.headers?.['user-agent'] ?? null,
        } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.event.create({
      data: { userId, name: 'support_ticket_created', props: { category: body.category } },
    });
    return { id: ticket.id, received: true };
  }
}

@Controller('v1/admin/tickets')
@Staff('admin')
export class SupportAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query('status') status?: 'open' | 'pending' | 'resolved') {
    const rows = await this.prisma.supportTicket.findMany({
      where: { status: status ?? { in: ['open', 'pending'] } },
      include: { user: { select: { id: true, phone: true, name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const now = Date.now();
    return rows
      .map((t) => ({
        ...t,
        priority: PRIORITY[t.category] ?? 3,
        /** F-SUP-04: 12-hour first-reply promise. */
        slaBreached: !t.firstResponseAt && now - t.createdAt.getTime() > SLA_MS,
        slaDueAt: new Date(t.createdAt.getTime() + SLA_MS),
      }))
      .sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());
  }

  @Get('stats')
  async stats() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.supportTicket.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, firstResponseAt: true, category: true },
    });
    const responded = rows
      .filter((r) => r.firstResponseAt)
      .map((r) => r.firstResponseAt!.getTime() - r.createdAt.getTime())
      .sort((a, b) => a - b);
    const median = responded.length ? responded[Math.floor(responded.length / 2)]! : null;
    const byCategory: Record<string, number> = {};
    for (const r of rows) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    return {
      tickets: rows.length,
      medianFirstResponseMinutes: median === null ? null : Math.round(median / 60_000),
      withinSlaPct: responded.length
        ? Math.round((100 * responded.filter((ms) => ms <= SLA_MS).length) / responded.length)
        : null,
      byCategory,
    };
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(ticketPatch)) body: z.infer<typeof ticketPatch>,
  ) {
    const before = await this.prisma.supportTicket.findUniqueOrThrow({ where: { id } });
    const now = new Date();
    const row = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...body,
        firstResponseAt:
          before.firstResponseAt ?? (body.status && body.status !== 'open' ? now : null),
        resolvedAt: body.status === 'resolved' ? now : body.status ? null : before.resolvedAt,
      },
    });
    await this.audit.record(req.auth.userId, 'update', 'support_ticket', id, before, row);
    return row;
  }
}
