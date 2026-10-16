import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import {
  AnswerDto,
  answerSchema,
  CreateTestDto,
  createTestSchema,
  SyncDto,
  syncSchema,
} from './tests.dto';
import { TestsService } from './tests.service';

@Controller('v1/tests')
@UseGuards(AuthGuard)
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  @Post()
  create(@Req() req: AuthedRequest, @Body(new ZodBodyPipe(createTestSchema)) body: CreateTestDto) {
    return this.tests.create(req.auth.userId, body);
  }

  @Get('open')
  open(@Req() req: AuthedRequest) {
    return this.tests.open(req.auth.userId);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.payload(req.auth.userId, id);
  }

  @Put(':id/items/:position')
  answer(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('position', ParseIntPipe) position: number,
    @Body(new ZodBodyPipe(answerSchema)) body: AnswerDto,
  ) {
    return this.tests.answer(req.auth.userId, id, position, body);
  }

  @Post(':id/sync')
  sync(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(syncSchema)) body: SyncDto,
  ) {
    return this.tests.sync(req.auth.userId, id, body.items);
  }

  @Post(':id/submit')
  submit(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(syncSchema.partial())) body: Partial<SyncDto>,
  ) {
    return this.tests.submit(req.auth.userId, id, body.items ?? []);
  }

  @Get(':id/review')
  review(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.results(req.auth.userId, id);
  }
}
