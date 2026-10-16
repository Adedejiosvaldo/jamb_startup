import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthedRequest } from '../auth/auth.guard';
import { Staff } from '../auth/staff.guard';
import { AuditService } from '../common/audit.service';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogueService } from './catalogue.service';
import { utmeSubjectsSchema } from './requirements';

const universitySchema = z.object({
  name: z.string().min(2),
  shortName: z.string().optional(),
  state: z.string().optional(),
  type: z.enum(['federal', 'state', 'private']).optional(),
});
const courseSchema = z.object({ name: z.string().min(2) });
const requirementSchema = z.object({
  universityId: z.string().uuid(),
  courseId: z.string().uuid(),
  utmeSubjects: utmeSubjectsSchema,
  olevelRequirements: z.string().optional(),
  notes: z.string().optional(),
  cutoffHint: z.string().optional(),
  cutoffScore: z.number().int().min(100).max(400).nullable().optional(),
  source: z.string().min(3, 'Source is required, e.g. "JAMB brochure 2026/2027 p.112"'),
  checkedAt: z.coerce.date(),
});
const topicSchema = z.object({
  subjectCode: z.string(),
  name: z.string().min(2),
  syllabusRef: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
  learnability: z.number().min(0.1).max(3).optional(),
  parentTopicId: z.string().uuid().nullable().optional(),
});
const topicPatch = topicSchema.omit({ subjectCode: true }).partial();
const announcementSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(3),
  officialSourceUrl: z.string().url().optional(),
  publish: z.boolean().default(false),
});

@Controller('v1/admin')
@Staff('admin')
export class CatalogueAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalogue: CatalogueService,
  ) {}

  @Post('universities')
  async createUniversity(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(universitySchema)) body: z.infer<typeof universitySchema>,
  ) {
    const row = await this.prisma.university.create({ data: body });
    await this.audit.record(req.auth.userId, 'create', 'university', row.id, null, row);
    return row;
  }

  @Patch('universities/:id')
  async updateUniversity(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(universitySchema.partial()))
    body: Partial<z.infer<typeof universitySchema>>,
  ) {
    const before = await this.prisma.university.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.university.update({ where: { id }, data: body });
    await this.audit.record(req.auth.userId, 'update', 'university', id, before, row);
    return row;
  }

  @Post('courses')
  async createCourse(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(courseSchema)) body: z.infer<typeof courseSchema>,
  ) {
    const row = await this.prisma.course.create({ data: body });
    await this.audit.record(req.auth.userId, 'create', 'course', row.id, null, row);
    return row;
  }

  @Get('requirements')
  async listRequirements() {
    const rows = await this.prisma.courseRequirement.findMany({
      include: { university: true, course: true },
      orderBy: [{ university: { name: 'asc' } }, { course: { name: 'asc' } }],
    });
    return Promise.all(rows.map((r) => this.catalogue.present(r)));
  }

  /** Upsert by (university, course). Source and checked date are mandatory (F-ACQ-01 AC). */
  @Put('requirements')
  async upsertRequirement(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(requirementSchema)) body: z.infer<typeof requirementSchema>,
  ) {
    const key = {
      universityId_courseId: { universityId: body.universityId, courseId: body.courseId },
    };
    const before = await this.prisma.courseRequirement.findUnique({ where: key });
    const row = await this.prisma.courseRequirement.upsert({
      where: key,
      update: body,
      create: body,
    });
    await this.audit.record(
      req.auth.userId,
      before ? 'update' : 'create',
      'course_requirement',
      row.id,
      before,
      row,
    );
    return row;
  }

  @Delete('requirements/:id')
  @HttpCode(204)
  async deleteRequirement(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const before = await this.prisma.courseRequirement.delete({ where: { id } });
    await this.audit.record(req.auth.userId, 'delete', 'course_requirement', id, before, null);
  }

  @Post('topics')
  async createTopic(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(topicSchema)) body: z.infer<typeof topicSchema>,
  ) {
    const { subjectCode, ...data } = body;
    const subject = await this.prisma.subject.findUniqueOrThrow({ where: { code: subjectCode } });
    const row = await this.prisma.topic.create({ data: { ...data, subjectId: subject.id } });
    await this.audit.record(req.auth.userId, 'create', 'topic', row.id, null, row);
    return row;
  }

  @Patch('topics/:id')
  async updateTopic(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(topicPatch)) body: z.infer<typeof topicPatch>,
  ) {
    const before = await this.prisma.topic.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.topic.update({ where: { id }, data: body });
    await this.audit.record(req.auth.userId, 'update', 'topic', id, before, row);
    return row;
  }

  /** Exam rules are data (spec §6.1): change a value without a deploy. */
  @Put('exam-config/:year/:key')
  async setExamConfig(
    @Req() req: AuthedRequest,
    @Param('year', ParseIntPipe) year: number,
    @Param('key') key: string,
    @Body(new ZodBodyPipe(z.object({ value: z.any() }))) body: { value: unknown },
  ) {
    const where = { year_key: { year, key } };
    const before = await this.prisma.examConfig.findUnique({ where });
    const value = (body.value ?? null) as object;
    const row = await this.prisma.examConfig.upsert({
      where,
      update: { value },
      create: { year, key, value },
    });
    await this.audit.record(req.auth.userId, 'update', 'exam_config', row.id, before, row);
    return row;
  }

  @Get('announcements')
  listAnnouncements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  @Post('announcements')
  async createAnnouncement(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(announcementSchema)) body: z.infer<typeof announcementSchema>,
  ) {
    const { publish, ...data } = body;
    const row = await this.prisma.announcement.create({
      data: { ...data, publishedAt: publish ? new Date() : null },
    });
    await this.audit.record(req.auth.userId, 'create', 'announcement', row.id, null, row);
    return row;
  }
}
