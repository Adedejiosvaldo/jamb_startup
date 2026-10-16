import { SR_INTERVALS } from './engine.config';

export interface SrState {
  intervalDays: number;
}

/**
 * F-PRAC-05: wrong answers return at 1, 3, 7, 14 days. A wrong answer resets
 * to day 1; a correct answer moves to the next step; correct at 14 days
 * graduates the item (returns null = remove from queue).
 */
export function nextReview(
  current: SrState | null,
  correct: boolean,
  now: Date,
): { intervalDays: number; dueAt: Date } | null {
  if (!correct) return { intervalDays: SR_INTERVALS[0]!, dueAt: addDays(now, SR_INTERVALS[0]!) };
  if (!current) return null; // correct and never missed: nothing to review
  const idx = SR_INTERVALS.indexOf(current.intervalDays);
  const next = SR_INTERVALS[idx + 1];
  if (idx === -1 || next === undefined) return null;
  return { intervalDays: next, dueAt: addDays(now, next) };
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
