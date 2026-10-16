import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async active(userId: string, now = new Date()) {
    return this.prisma.entitlement.findFirst({
      where: { userId, revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
      include: { product: true },
    });
  }

  async isPaid(userId: string, now = new Date()): Promise<boolean> {
    return !!(await this.active(userId, now));
  }

  /**
   * Season pass ends 7 days after the UTME (spec §22), read from exam_config
   * `utme_window`. If JAMB hasn't announced dates yet, fall back to 30 June of
   * the exam year [VERIFY each year].
   */
  async seasonEnd(examYear: number): Promise<Date> {
    const row = await this.prisma.examConfig.findUnique({
      where: { year_key: { year: examYear, key: 'utme_window' } },
    });
    const window = row?.value as { end?: string | null; start?: string | null } | null;
    const end = window?.end ?? window?.start;
    if (end) return new Date(new Date(end).getTime() + 7 * DAY);
    return new Date(`${examYear}-06-30T23:00:00.000Z`);
  }

  /** UTME start date for countdowns, if known. */
  async examDate(examYear: number): Promise<Date | null> {
    const row = await this.prisma.examConfig.findUnique({
      where: { year_key: { year: examYear, key: 'utme_window' } },
    });
    const start = (row?.value as { start?: string | null } | null)?.start;
    return start ? new Date(start) : null;
  }
}
