import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthedRequest } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { PrismaService } from '../prisma/prisma.service';

/** Spec §16 taxonomy — client-side events only; payment/server events are written by the API. */
const CLIENT_EVENTS = [
  'landing_viewed',
  'checker_used',
  'diagnostic_started',
  'diagnostic_completed',
  'paywall_viewed',
  'pay_link_created',
  'plan_item_completed',
  'practice_answered',
  'streak_extended',
  'explanation_viewed',
  'question_reported',
  'offline_sync_completed',
  'pack_downloaded',
] as const;

const eventSchema = z.object({
  name: z.enum(CLIENT_EVENTS),
  anonId: z.string().max(64).optional(),
  props: z.record(z.unknown()).default({}),
});

@Controller('v1/events')
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(202)
  @UseGuards(OptionalAuthGuard)
  async track(
    @Req() req: Partial<AuthedRequest>,
    @Body(new ZodBodyPipe(eventSchema)) body: z.infer<typeof eventSchema>,
  ) {
    await this.prisma.event.create({
      data: {
        userId: req.auth?.userId ?? null,
        anonId: body.anonId,
        name: body.name,
        props: body.props as Prisma.InputJsonValue,
      },
    });
    return { ok: true };
  }
}
