import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Question } from '@prisma/client';
import { ApiError } from '../auth/auth.errors';
import { AuditService } from '../common/audit.service';
import { addDays } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { FLAG_THRESHOLD, importRowSchema, QuestionCreate, QuestionPatch } from './content.dto';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filter: {
    subject?: string;
    topicId?: string;
    status?: Question['status'];
    q?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.QuestionWhereInput = {
      ...(filter.subject ? { subject: { code: filter.subject.toUpperCase() } } : {}),
      ...(filter.topicId ? { topicId: filter.topicId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { stem: { contains: filter.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          subject: { select: { code: true } },
          topic: { select: { name: true } },
          _count: { select: { reports: { where: { status: 'open' } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.question.count({ where }),
    ]);
    return {
      items,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      pages: Math.max(1, Math.ceil(total / filter.pageSize)),
    };
  }

  async get(id: string) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: { subject: true, topic: true, reports: { orderBy: { createdAt: 'desc' } } },
    });
    if (!q) throw new ApiError(HttpStatus.NOT_FOUND, 'QUESTION_NOT_FOUND', 'Question not found.');
    const history = await this.prisma.auditLog.findMany({
      where: { entity: 'question', entityId: id },
      orderBy: { ts: 'desc' },
      take: 50,
    });
    return { ...q, history };
  }

  async create(actorId: string, data: QuestionCreate) {
    const topic = await this.prisma.topic.findUnique({ where: { id: data.topicId } });
    if (!topic) throw new ApiError(HttpStatus.BAD_REQUEST, 'TOPIC_NOT_FOUND', 'Topic not found.');
    const row = await this.prisma.question.create({
      data: {
        ...(this.toData(data) as Omit<
          Prisma.QuestionUncheckedCreateInput,
          'subjectId' | 'topicId'
        >),
        topicId: topic.id,
        subjectId: topic.subjectId,
        authorId: actorId,
        status: 'draft',
      },
    });
    await this.audit.record(actorId, 'create', 'question', row.id, null, row);
    return row;
  }

  /**
   * Any content edit bumps the version and sends the question back to draft
   * for re-review (spec §8.2 pipeline: fix → re-review → live). The previous
   * version is kept in audit_log.
   */
  async update(actorId: string, id: string, patch: QuestionPatch) {
    const before = await this.prisma.question.findUniqueOrThrow({ where: { id } });
    let subjectId = before.subjectId;
    if (patch.topicId) {
      const topic = await this.prisma.topic.findUniqueOrThrow({ where: { id: patch.topicId } });
      subjectId = topic.subjectId;
    }
    const row = await this.prisma.question.update({
      where: { id },
      data: {
        ...this.toData(patch),
        subjectId,
        version: { increment: 1 },
        status: 'draft',
        reviewedBy: null,
        reviewedAt: null,
      },
    });
    await this.audit.record(actorId, 'update', 'question', id, before, row);
    return row;
  }

  /** Second-person review: the author can't approve their own question. */
  async review(actorId: string, id: string, decision: 'approve' | 'reject', note?: string) {
    const before = await this.prisma.question.findUniqueOrThrow({ where: { id } });
    if (before.status !== 'draft' && before.status !== 'flagged') {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'NOT_REVIEWABLE',
        `Only draft or flagged questions can be reviewed (is ${before.status}).`,
      );
    }
    if (decision === 'approve' && before.authorId === actorId) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'SELF_REVIEW',
        'A different reviewer must approve your question.',
      );
    }
    if (decision === 'approve' && !before.explanationCorrect) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'EXPLANATION_REQUIRED',
        'Add an explanation before approving.',
      );
    }
    const row = await this.prisma.question.update({
      where: { id },
      data:
        decision === 'approve'
          ? { status: 'reviewed', reviewedBy: actorId, reviewedAt: new Date() }
          : { status: 'draft', reviewedBy: null, reviewedAt: null },
    });
    await this.audit.record(actorId, `review_${decision}`, 'question', id, before, {
      ...row,
      note,
    });
    return row;
  }

  async publish(actorId: string, ids: string[]) {
    const rows = await this.prisma.question.findMany({ where: { id: { in: ids } } });
    const notReady = rows.filter((r) => r.status !== 'reviewed').map((r) => r.id);
    if (notReady.length || rows.length !== ids.length) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'NOT_REVIEWED',
        'Only reviewed questions can be published.',
        { ids: notReady },
      );
    }
    await this.prisma.question.updateMany({ where: { id: { in: ids } }, data: { status: 'live' } });
    for (const r of rows)
      await this.audit.record(
        actorId,
        'publish',
        'question',
        r.id,
        { status: r.status },
        { status: 'live' },
      );
    return { published: ids.length };
  }

  async retire(actorId: string, id: string) {
    const before = await this.prisma.question.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.question.update({ where: { id }, data: { status: 'retired' } });
    await this.audit.record(actorId, 'retire', 'question', id, before, row);
    return row;
  }

  /** Bulk import as drafts. Validates every row first; imports nothing if any row is invalid. */
  async import(actorId: string, rows: unknown[]) {
    const topics = await this.prisma.topic.findMany({ include: { subject: true } });
    const topicKey = (code: string, name: string) =>
      `${code.toUpperCase()}::${name.trim().toLowerCase()}`;
    const byKey = new Map(topics.map((t) => [topicKey(t.subject.code, t.name), t]));

    const errors: { row: number; message: string }[] = [];
    const valid: Prisma.QuestionCreateManyInput[] = [];
    rows.forEach((raw, i) => {
      const parsed = importRowSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({
          row: i + 1,
          message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '),
        });
        return;
      }
      const { subjectCode, topicName, ...q } = parsed.data;
      const topic = byKey.get(topicKey(subjectCode, topicName));
      if (!topic) {
        errors.push({ row: i + 1, message: `Unknown topic "${topicName}" in ${subjectCode}` });
        return;
      }
      valid.push({
        ...this.toData(q),
        subjectId: topic.subjectId,
        topicId: topic.id,
        authorId: actorId,
        status: 'draft',
      } as Prisma.QuestionCreateManyInput);
    });
    if (errors.length) return { imported: 0, errors };
    const res = await this.prisma.question.createMany({ data: valid });
    await this.audit.record(actorId, 'import', 'question', null, null, { count: res.count });
    return { imported: res.count, errors: [] };
  }

  /** F-SUP-03: auto-hide after FLAG_THRESHOLD independent open reports. */
  async report(userId: string, questionId: string, reason: string, note?: string) {
    const q = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!q) throw new ApiError(HttpStatus.NOT_FOUND, 'QUESTION_NOT_FOUND', 'Question not found.');
    const existing = await this.prisma.questionReport.findFirst({
      where: { questionId, userId, status: 'open' },
    });
    if (!existing)
      await this.prisma.questionReport.create({ data: { questionId, userId, reason, note } });

    const reporters = await this.prisma.questionReport.findMany({
      where: { questionId, status: 'open' },
      distinct: ['userId'],
      select: { userId: true },
    });
    if (q.status === 'live' && reporters.length >= FLAG_THRESHOLD) {
      await this.prisma.question.update({ where: { id: questionId }, data: { status: 'flagged' } });
      await this.audit.record(
        null,
        'auto_flag',
        'question',
        questionId,
        { status: 'live' },
        { status: 'flagged', reports: reporters.length },
      );
    }
    return { received: true };
  }

  listReports(status: 'open' | 'confirmed' | 'rejected' = 'open') {
    return this.prisma.questionReport.findMany({
      where: { status },
      include: {
        question: {
          select: { id: true, stem: true, status: true, subject: { select: { code: true } } },
        },
        user: { select: { phone: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async resolveReport(
    actorId: string,
    id: string,
    decision: 'confirmed' | 'rejected',
    rewardDays: number,
  ) {
    const report = await this.prisma.questionReport.findUniqueOrThrow({ where: { id } });
    const now = new Date();
    let rewarded = false;
    if (decision === 'confirmed' && rewardDays > 0 && report.userId) {
      const ent = await this.prisma.entitlement.findFirst({
        where: { userId: report.userId, revokedAt: null, endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
      });
      if (ent) {
        await this.prisma.entitlement.update({
          where: { id: ent.id },
          data: { endsAt: addDays(ent.endsAt, rewardDays) },
        });
        rewarded = true;
      }
    }
    const row = await this.prisma.questionReport.update({
      where: { id },
      data: { status: decision, resolvedBy: actorId, resolvedAt: now, rewardGiven: rewarded },
    });
    // Confirmed problem on a live question: pull it until it's fixed and re-reviewed.
    if (decision === 'confirmed') {
      await this.prisma.question.updateMany({
        where: { id: report.questionId, status: 'live' },
        data: { status: 'flagged' },
      });
    }
    await this.audit.record(actorId, `report_${decision}`, 'question_report', id, report, row);
    return row;
  }

  private toData(q: Partial<QuestionCreate>) {
    const { topicId: _topicId, explanationsWrong, options, ...rest } = q;
    return {
      ...rest,
      ...(options ? { options } : {}),
      ...(explanationsWrong ? { explanationsWrong } : {}),
    };
  }
}
