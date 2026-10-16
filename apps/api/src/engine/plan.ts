import { FREE_TIER, REVIEW } from './engine.config';

export type PlanItemKind =
  | 'diagnostic'
  | 'practice'
  | 'review'
  | 'mini_mock'
  | 'full_mock'
  | 'speed_drill';

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  title: string;
  subjectCode?: string;
  topicId?: string;
  count?: number;
  estMinutes: number;
  /** Shown but needs a Season Pass. */
  locked: boolean;
  completedAt?: string | null;
}

export interface PlanTopic {
  id: string;
  name: string;
  subjectCode: string;
  weight: number;
  learnability: number;
  mastery: number;
  /** Live questions available in this topic. */
  available: number;
}

export interface PlanInput {
  paid: boolean;
  hasDiagnostic: boolean;
  /** 0 = Sunday … 6 = Saturday (Lagos). */
  weekday: number;
  daysToExam: number | null;
  dailyMinutes: number;
  dueReviewCount: number;
  topics: PlanTopic[];
  /** Days since each subject was last practised (missing = never). */
  daysSinceSubject: Record<string, number>;
  /** Days since the student's first plan (for "after week 2" rules). */
  planAgeDays: number;
  subjects: string[];
}

/** Roughly how long one practice question takes, including reading the explanation. */
const MINUTES_PER_QUESTION = 1.2;

/** Spec §7.2: priority = weight × (1 − mastery) × learnability × urgency. */
export function topicPriority(t: PlanTopic, daysToExam: number | null): number {
  const urgency = daysToExam !== null && daysToExam < 60 && t.weight >= 0.05 ? 1.5 : 1;
  const weight = t.weight > 0 ? t.weight : 0.01;
  return weight * (1 - t.mastery) * t.learnability * urgency;
}

/**
 * Rule-based daily plan (spec §7.3/§7.4). Never piles up missed days: the
 * plan is always built fresh for today.
 */
export function buildDailyPlan(input: PlanInput): PlanItem[] {
  const items: PlanItem[] = [];
  const lock = (paidOnly: boolean) => paidOnly && !input.paid;

  if (!input.hasDiagnostic) {
    return [
      {
        id: 'diagnostic',
        kind: 'diagnostic',
        title: 'Take your diagnostic test',
        estMinutes: 80,
        locked: false,
      },
    ];
  }

  // Final two weeks: full mocks and mistake review only.
  if (input.daysToExam !== null && input.daysToExam <= 14 && input.daysToExam >= 0) {
    items.push({
      id: 'full_mock',
      kind: 'full_mock',
      title: 'Full mock exam',
      estMinutes: 120,
      locked: lock(true),
    });
    if (input.dueReviewCount > 0) {
      items.push(reviewItem(Math.min(input.dueReviewCount, REVIEW.maxPerSession), input.paid));
    }
    return items;
  }

  // Saturday: weekly mini-mock instead of the normal plan (F-CBT-06).
  if (input.weekday === 6) {
    items.push({
      id: 'mini_mock',
      kind: 'mini_mock',
      title: 'Weekly mini-mock',
      estMinutes: 65,
      locked: lock(true),
    });
    return items;
  }

  let budget = input.paid
    ? input.dailyMinutes
    : Math.round(FREE_TIER.practiceQuestionsPerDay * MINUTES_PER_QUESTION);

  // ~25% of the day for due mistakes.
  if (input.paid && input.dueReviewCount > 0) {
    const count = Math.min(
      input.dueReviewCount,
      REVIEW.maxPerSession,
      Math.max(5, Math.round((budget * 0.25) / MINUTES_PER_QUESTION)),
    );
    items.push(reviewItem(count, true));
    budget -= Math.round(count * MINUTES_PER_QUESTION);
  }

  // Speed drill every 2nd day after week 2.
  if (input.paid && input.planAgeDays >= 14 && input.planAgeDays % 2 === 0) {
    const subject = input.subjects.includes('MTH')
      ? 'MTH'
      : (input.subjects.find((s) => s !== 'ENG') ?? 'ENG');
    items.push({
      id: `speed_${subject}`,
      kind: 'speed_drill',
      title: `Speed drill: ${subject}`,
      subjectCode: subject,
      count: 10,
      estMinutes: 7,
      locked: false,
    });
    budget -= 7;
  }

  const candidates = input.topics.filter((t) => t.available > 0);
  if (candidates.length) {
    // Rotation: a subject untouched for >3 days gets the first slot.
    const stale = input.subjects
      .filter((s) => (input.daysSinceSubject[s] ?? Infinity) > 3)
      .sort(
        (a, b) => (input.daysSinceSubject[b] ?? Infinity) - (input.daysSinceSubject[a] ?? Infinity),
      );
    const ranked = [...candidates].sort(
      (a, b) => topicPriority(b, input.daysToExam) - topicPriority(a, input.daysToExam),
    );

    const picks: PlanTopic[] = [];
    for (const s of stale) {
      const best = ranked.find((t) => t.subjectCode === s && !picks.includes(t));
      if (best) {
        picks.push(best);
        break;
      }
    }
    for (const t of ranked) {
      if (picks.length >= 2) break;
      if (!picks.includes(t) && !picks.some((p) => p.subjectCode === t.subjectCode)) picks.push(t);
    }

    const totalQuestions = Math.max(10, Math.round(Math.max(budget, 10) / MINUTES_PER_QUESTION));
    const perTopic = Math.ceil(totalQuestions / picks.length);
    for (const t of picks) {
      const count = Math.max(5, Math.min(25, perTopic, t.available));
      items.push({
        id: `practice_${t.id}`,
        kind: 'practice',
        title: `${t.subjectCode}: ${t.name}`,
        subjectCode: t.subjectCode,
        topicId: t.id,
        count,
        estMinutes: Math.round(count * MINUTES_PER_QUESTION),
        locked: false,
      });
    }
  }

  if (!input.paid && input.dueReviewCount > 0) {
    items.push(reviewItem(Math.min(input.dueReviewCount, REVIEW.maxPerSession), false));
  }
  return items;
}

function reviewItem(count: number, paid: boolean): PlanItem {
  return {
    id: 'review',
    kind: 'review',
    title: `Review ${count} past mistake${count === 1 ? '' : 's'}`,
    count,
    estMinutes: Math.round(count * MINUTES_PER_QUESTION),
    locked: !paid,
  };
}
