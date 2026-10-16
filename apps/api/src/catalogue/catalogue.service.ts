import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../auth/auth.errors';
import { PrismaService } from '../prisma/prisma.service';
import { UtmeSubjects, utmeSubjectsSchema } from './requirements';

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  subjects() {
    return this.prisma.subject.findMany({
      where: { active: true },
      orderBy: [{ code: 'asc' }],
      select: { id: true, code: true, name: true, questionCountInExam: true },
    });
  }

  async topics(subjectCode: string) {
    const subject = await this.prisma.subject.findUnique({ where: { code: subjectCode } });
    if (!subject)
      throw new ApiError(HttpStatus.NOT_FOUND, 'SUBJECT_NOT_FOUND', 'Subject not found.');
    return this.prisma.topic.findMany({
      where: { subjectId: subject.id },
      orderBy: [{ weight: 'desc' }, { name: 'asc' }],
    });
  }

  universities() {
    return this.prisma.university.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, shortName: true, state: true, type: true },
    });
  }

  /** Courses, optionally only those with a requirement record at the given university. */
  courses(universityId?: string) {
    return this.prisma.course.findMany({
      where: universityId ? { requirements: { some: { universityId } } } : undefined,
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async requirement(universityId: string, courseId: string) {
    const req = await this.prisma.courseRequirement.findUnique({
      where: { universityId_courseId: { universityId, courseId } },
      include: { university: true, course: true },
    });
    if (!req) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'REQUIREMENT_NOT_FOUND',
        'We do not have this course yet.',
      );
    }
    return this.present(req);
  }

  async present(
    req: Prisma.CourseRequirementGetPayload<{ include: { university: true; course: true } }>,
  ) {
    const subjects = utmeSubjectsSchema.parse(req.utmeSubjects) as UtmeSubjects;
    const codes = [...subjects.required, ...subjects.choose.flatMap((g) => g.from)];
    const names = new Map(
      (await this.prisma.subject.findMany({ where: { code: { in: codes } } })).map((s) => [
        s.code,
        s.name,
      ]),
    );
    const name = (c: string) => names.get(c) ?? c;
    return {
      id: req.id,
      university: {
        id: req.university.id,
        name: req.university.name,
        shortName: req.university.shortName,
      },
      course: { id: req.course.id, name: req.course.name },
      utmeSubjects: {
        required: subjects.required.map((code) => ({ code, name: name(code) })),
        choose: subjects.choose.map((g) => ({
          count: g.count,
          from: g.from.map((code) => ({ code, name: name(code) })),
        })),
      },
      olevelRequirements: req.olevelRequirements,
      notes: req.notes,
      cutoffHint: req.cutoffHint,
      cutoffScore: req.cutoffScore,
      source: req.source,
      checkedAt: req.checkedAt,
    };
  }

  async examConfig(year: number): Promise<Record<string, unknown>> {
    const rows = await this.prisma.examConfig.findMany({ where: { year } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  announcements() {
    return this.prisma.announcement.findMany({
      where: { publishedAt: { not: null, lte: new Date() } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
  }
}
