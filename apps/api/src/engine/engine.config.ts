import { TestType } from '@prisma/client';

/**
 * Bump when prediction maths or mock blueprints change. Every test and
 * prediction stores the version so the guarantee (spec §22) compares like
 * with like (spec §6.4).
 */
export const ENGINE_VERSION = 'v1.0';

/** JAMB pace: 180 questions in 120 minutes [VERIFY] = 40 s per question. */
export const EXAM_PACE_MS = 40_000;

export const PREDICTION = {
  /** Spec §6.4: a subject needs 30 answered questions for a full estimate. */
  readyMinPerSubject: 30,
  /** Below this a subject shows "need more data". Between this and ready: an early, wider estimate. */
  earlyMinPerSubject: 5,
  /** ± k / sqrt(n) per subject (spec §6.2 step 4). */
  rangeK: 80,
  rangeFloor: 10,
  rangeCeiling: 40,
  /** Wider floor while any subject is still "early" (short diagnostic, F-DIAG-02). */
  earlyRangeFloor: 25,
  recencyDays: 14,
  recencyWeight: 2,
  /** Item weight by difficulty (1 easy, 2 medium, 3 hard): harder items count more. */
  difficultyWeight: { 1: 0.8, 2: 1, 3: 1.25 } as Record<number, number>,
  /** Accuracy shrinks/raises 8% per difficulty step away from the exam's assumed medium mix. */
  difficultyCorrection: 0.08,
  /** Pseudo-count pulling sparse topics toward the subject's overall accuracy. */
  topicShrink: 2,
  /** Speed penalty only once we've seen enough timed answers. */
  speedMinTimedItems: 20,
  /** Considered history. */
  lookbackDays: 120,
} as const;

export interface Blueprint {
  /** Questions per subject; `ENG` overrides `default`. */
  perSubject: { ENG: number; default: number };
  minutes: number;
  /** Counts toward predicted score updates. */
  predicts: boolean;
}

/** Spec §5.3/§5.5. Full diagnostic is sized so every subject reaches the 30-question rule. */
export const BLUEPRINTS: Partial<Record<TestType, Blueprint>> = {
  diagnostic: { perSubject: { ENG: 30, default: 30 }, minutes: 80, predicts: true },
  short_diagnostic: { perSubject: { ENG: 10, default: 7 }, minutes: 20, predicts: true },
  mini_mock: { perSubject: { ENG: 25, default: 25 }, minutes: 65, predicts: true },
  full_mock: { perSubject: { ENG: 60, default: 40 }, minutes: 120, predicts: true },
};

export const PRACTICE = { defaultCount: 15, min: 5, max: 25 };
export const SPEED_DRILL = { count: 10 };
export const REVIEW = { maxPerSession: 25 };

/** Free tier (spec §22). */
export const FREE_TIER = { practiceQuestionsPerDay: 20, mocksPerMonth: 1 };

/** Spaced repetition intervals in days (F-PRAC-05). A correct answer at the last step graduates the item. */
export const SR_INTERVALS = [1, 3, 7, 14];
