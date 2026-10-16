import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../auth/auth.errors';
import { checkCombination, utmeSubjectsSchema } from '../catalogue/requirements';
import { EntitlementsService } from '../commerce/entitlements.service';
import { maskPhone } from '../common/phone';
import { ENV, Env } from '../config/env';
import { OutboxService, waLink } from '../messaging/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilePatch } from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly outbox: OutboxService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        studentProfile: { include: { targetCourse: true, targetUniversity: true } },
        subjects: { include: { subject: true } },
        parentLinks: { where: { optedOutAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const ent = await this.entitlements.active(userId);
    const p = user.studentProfile;
    const subjects = user.subjects
      .map((s) => ({ code: s.subject.code, name: s.subject.name }))
      .sort((a, b) =>
        a.code === 'ENG' ? -1 : b.code === 'ENG' ? 1 : a.code.localeCompare(b.code),
      );
    const parent = user.parentLinks[0];
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      state: user.state,
      examYear: user.examYear,
      mfaEnabled: !!user.totpEnabledAt,
      profile: p && {
        track: p.track,
        lastUtmeScore: p.lastUtmeScore,
        dailyMinutes: p.dailyMinutes,
        deviceType: p.deviceType,
        targetScore: p.targetScore,
        targetUniversity: p.targetUniversity && {
          id: p.targetUniversity.id,
          name: p.targetUniversity.name,
          shortName: p.targetUniversity.shortName,
        },
        targetCourse: p.targetCourse && { id: p.targetCourse.id, name: p.targetCourse.name },
        onboardingDone: !!p.onboardingDoneAt,
      },
      subjects,
      parent: parent && { phone: maskPhone(parent.parentPhone), optedIn: !!parent.optedInAt },
      plan: ent
        ? {
            paid: true,
            productCode: ent.product.code,
            productName: ent.product.name,
            endsAt: ent.endsAt,
          }
        : { paid: false },
    };
  }

  async update(userId: string, patch: ProfilePatch) {
    const { name, state, examYear, ...profile } = patch;
    await this.prisma.user.update({ where: { id: userId }, data: { name, state, examYear } });

    // Default the target score from the course's last known cut-off when the student hasn't set one.
    if (profile.targetCourseId && profile.targetUniversityId && profile.targetScore === undefined) {
      const req = await this.prisma.courseRequirement.findUnique({
        where: {
          universityId_courseId: {
            universityId: profile.targetUniversityId,
            courseId: profile.targetCourseId,
          },
        },
      });
      const existing = await this.prisma.studentProfile.findUnique({ where: { userId } });
      if (req?.cutoffScore && !existing?.targetScore) profile.targetScore = req.cutoffScore;
    }

    await this.prisma.studentProfile.upsert({
      where: { userId },
      update: profile,
      create: { userId, ...profile },
    });
    await this.maybeCompleteOnboarding(userId);
    return this.me(userId);
  }

  /** Sets the 3 non-English subjects. English is always included. Warns if the target course needs others. */
  async setSubjects(userId: string, codes: string[]) {
    const all = ['ENG', ...codes];
    const subjects = await this.prisma.subject.findMany({
      where: { code: { in: all }, active: true },
    });
    if (subjects.length !== 4) {
      const found = new Set(subjects.map((s) => s.code));
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'UNKNOWN_SUBJECT',
        `Unknown subject: ${all.filter((c) => !found.has(c)).join(', ')}`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.studentSubject.deleteMany({ where: { userId } }),
      this.prisma.studentSubject.createMany({
        data: subjects.map((s) => ({ userId, subjectId: s.id })),
      }),
    ]);
    // A subject change invalidates today's plan (F-ACC-03: "changing subjects recalculates plan").
    await this.prisma.dailyPlan.deleteMany({ where: { userId, completedAt: null } });
    await this.maybeCompleteOnboarding(userId);

    const profile = await this.prisma.studentProfile.findUnique({ where: { userId } });
    let warnings: string[] = [];
    if (profile?.targetCourseId && profile.targetUniversityId) {
      const req = await this.prisma.courseRequirement.findUnique({
        where: {
          universityId_courseId: {
            universityId: profile.targetUniversityId,
            courseId: profile.targetCourseId,
          },
        },
      });
      if (req)
        warnings = checkCombination(utmeSubjectsSchema.parse(req.utmeSubjects), all).problems;
    }
    return { subjects: all, warnings };
  }

  /** F-ACC-04: add a parent; they must opt in from the link before any report is sent. */
  async linkParent(userId: string, parentPhone: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (parentPhone === user.phone) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'PARENT_SAME_PHONE',
        "Use your parent's number, not yours.",
      );
    }
    const link = await this.prisma.parentLink.upsert({
      where: { studentId_parentPhone: { studentId: userId, parentPhone } },
      update: { optedOutAt: null },
      create: { studentId: userId, parentPhone },
    });
    const first = user.name?.split(' ')[0] ?? 'Your child';
    const url = `${this.env.WEB_URL}/p/${link.reportToken}`;
    const text =
      `Hello! ${first} is preparing for JAMB with ScoreCoach and would like to send you a short weekly ` +
      `progress report on WhatsApp. To agree, open ${url} and tap "Yes, send me reports". ` +
      `You can stop at any time by replying STOP.`;
    await this.outbox.queueWhatsApp(parentPhone, 'parent_optin', text, userId);
    // The student can also forward it themselves straight away.
    return { optedIn: !!link.optedInAt, shareUrl: waLink(parentPhone, text) };
  }

  private async maybeCompleteOnboarding(userId: string) {
    const [user, profile, subjectCount] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.studentProfile.findUnique({ where: { userId } }),
      this.prisma.studentSubject.count({ where: { userId } }),
    ]);
    if (
      profile &&
      !profile.onboardingDoneAt &&
      user.examYear &&
      profile.dailyMinutes &&
      subjectCount === 4
    ) {
      await this.prisma.studentProfile.update({
        where: { userId },
        data: { onboardingDoneAt: new Date() },
      });
    }
  }
}
