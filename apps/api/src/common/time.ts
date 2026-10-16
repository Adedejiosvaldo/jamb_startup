/** Nigeria is UTC+1 all year (no DST). All "today" logic uses Lagos dates. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** YYYY-MM-DD in Africa/Lagos. */
export function lagosDateString(at = new Date()): string {
  return new Date(at.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight UTC of the Lagos calendar date — the value Prisma stores in a @db.Date column. */
export function lagosDate(at = new Date()): Date {
  return new Date(`${lagosDateString(at)}T00:00:00.000Z`);
}

/** 0 = Sunday … 6 = Saturday, in Lagos. */
export function lagosWeekday(at = new Date()): number {
  return new Date(at.getTime() + LAGOS_OFFSET_MS).getUTCDay();
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}
