import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { LearningService } from './learning.service';

@Controller('v1')
@UseGuards(AuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('plan/today')
  today(@Req() req: AuthedRequest) {
    return this.learning.today(req.auth.userId);
  }

  @Post('plan/today/complete-item')
  complete(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(z.object({ itemId: z.string().min(1) }))) body: { itemId: string },
  ) {
    return this.learning.completeItem(req.auth.userId, body.itemId);
  }

  @Get('review/due')
  reviewDue(@Req() req: AuthedRequest) {
    return this.learning.reviewDue(req.auth.userId);
  }

  @Get('predictions/latest')
  latest(@Req() req: AuthedRequest) {
    return this.learning.latestPrediction(req.auth.userId);
  }

  @Get('predictions/history')
  history(@Req() req: AuthedRequest) {
    return this.learning.predictions(req.auth.userId);
  }

  @Get('progress')
  progress(@Req() req: AuthedRequest) {
    return this.learning.progress(req.auth.userId);
  }
}
