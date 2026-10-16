import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthedRequest } from '../auth/auth.guard';
import { Staff } from '../auth/staff.guard';
import { AuditService } from '../common/audit.service';
import { normaliseNigerianPhone } from '../common/phone';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolsService } from './schools.service';

const schoolSchema = z.object({
  name: z.string().min(2),
  lga: z.string().optional(),
  state: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});
const eventSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(['paper_mock', 'lab_mock']).default('paper_mock'),
  name: z.string().optional(),
  subjects: z.array(z.string().toUpperCase()).min(1).max(4),
  perSubject: z.number().int().min(5).max(60).default(20),
  couponCode: z.string().max(40).optional(),
});
const entrySchema = z.object({
  studentName: z.string().trim().min(1).max(80),
  className: z.string().max(40).optional(),
  parentPhone: z
    .string()
    .optional()
    .transform((v) => (v ? normaliseNigerianPhone(v) : null)),
  answers: z.record(z.string().toUpperCase(), z.string().max(200)),
});

@Controller('v1/admin')
@Staff('admin')
export class SchoolsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schools: SchoolsService,
    private readonly audit: AuditService,
  ) {}

  @Get('schools')
  list() {
    return this.prisma.school.findMany({
      orderBy: { name: 'asc' },
      include: {
        events: { orderBy: { date: 'desc' }, include: { _count: { select: { entries: true } } } },
      },
    });
  }

  @Post('schools')
  async create(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(schoolSchema)) body: z.infer<typeof schoolSchema>,
  ) {
    const row = await this.prisma.school.create({ data: body });
    await this.audit.record(req.auth.userId, 'create', 'school', row.id, null, row);
    return row;
  }

  @Patch('schools/:id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(schoolSchema.partial())) body: Partial<z.infer<typeof schoolSchema>>,
  ) {
    const before = await this.prisma.school.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.school.update({ where: { id }, data: body });
    await this.audit.record(req.auth.userId, 'update', 'school', id, before, row);
    return row;
  }

  @Post('schools/:id/events')
  createEvent(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(eventSchema)) body: z.infer<typeof eventSchema>,
  ) {
    return this.schools.createEvent(req.auth.userId, id, body);
  }

  @Get('school-events/:id')
  event(@Param('id', ParseUUIDPipe) id: string) {
    return this.schools.event(id);
  }

  @Post('school-events/:id/entries')
  addEntry(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(entrySchema)) body: z.infer<typeof entrySchema>,
  ) {
    return this.schools.addEntry(req.auth.userId, id, body);
  }

  @Delete('school-entries/:entryId')
  @HttpCode(204)
  async deleteEntry(
    @Req() req: AuthedRequest,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<void> {
    await this.schools.deleteEntry(req.auth.userId, entryId);
  }

  @Get('school-events/:id/report')
  report(@Param('id', ParseUUIDPipe) id: string) {
    return this.schools.classReport(id);
  }

  @Get('school-entries/:entryId/report')
  entryReport(@Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.schools.entryReport(entryId);
  }
}
