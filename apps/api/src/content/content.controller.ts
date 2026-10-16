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
import { z } from 'zod';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { Staff } from '../auth/staff.guard';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { ZodQueryPipe } from '../common/zod-query.pipe';
import {
  importSchema,
  QuestionCreate,
  questionCreateSchema,
  questionListQuery,
  QuestionPatch,
  questionPatchSchema,
  reportSchema,
  resolveReportSchema,
  reviewSchema,
} from './content.dto';
import { ContentService } from './content.service';

@Controller('v1/admin')
@Staff('admin', 'reviewer')
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}

  @Get('questions')
  list(@Query(new ZodQueryPipe(questionListQuery)) q: z.infer<typeof questionListQuery>) {
    return this.content.list(q);
  }

  @Get('questions/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.get(id);
  }

  @Post('questions')
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(questionCreateSchema)) body: QuestionCreate,
  ) {
    return this.content.create(req.auth.userId, body);
  }

  @Patch('questions/:id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(questionPatchSchema)) body: QuestionPatch,
  ) {
    return this.content.update(req.auth.userId, id, body);
  }

  @Post('questions/:id/review')
  review(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(reviewSchema)) body: z.infer<typeof reviewSchema>,
  ) {
    return this.content.review(req.auth.userId, id, body.decision, body.note);
  }

  @Post('questions/import')
  import(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(importSchema)) body: z.infer<typeof importSchema>,
  ) {
    return this.content.import(req.auth.userId, body.rows);
  }

  @Get('question-reports')
  reports(@Query('status') status?: 'open' | 'confirmed' | 'rejected') {
    return this.content.listReports(status ?? 'open');
  }
}

/** Publishing and retiring are admin-only. */
@Controller('v1/admin')
@Staff('admin')
export class ContentPublishController {
  constructor(private readonly content: ContentService) {}

  @Post('questions/publish')
  publish(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(z.object({ ids: z.array(z.string().uuid()).min(1) })))
    body: { ids: string[] },
  ) {
    return this.content.publish(req.auth.userId, body.ids);
  }

  @Post('questions/:id/retire')
  retire(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.retire(req.auth.userId, id);
  }

  @Post('question-reports/:id/resolve')
  resolve(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(resolveReportSchema)) body: z.infer<typeof resolveReportSchema>,
  ) {
    return this.content.resolveReport(req.auth.userId, id, body.decision, body.rewardDays);
  }
}

@Controller('v1/questions')
@UseGuards(AuthGuard)
export class QuestionReportController {
  constructor(private readonly content: ContentService) {}

  @Post(':id/report')
  report(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(reportSchema)) body: z.infer<typeof reportSchema>,
  ) {
    return this.content.report(req.auth.userId, id, body.reason, body.note);
  }
}
