import { buildDailyPlan, PlanInput } from './plan';
import { AnsweredItem, predict, SubjectInput } from './prediction';
import { allocateByWeight, shuffle } from './selection';
import { nextReview } from './spaced-repetition';

const NOW = new Date('2027-03-01T12:00:00Z');

function items(n: number, correctRate: number, opts: Partial<AnsweredItem> = {}): AnsweredItem[] {
  return Array.from({ length: n }, (_, i) => ({
    topicId: `t${i % 3}`,
    correct: i < Math.round(n * correctRate),
    difficulty: 2,
    answeredAt: NOW,
    timed: false,
    ...opts,
  }));
}

const topics = [
  { id: 't0', weight: 0.5 },
  { id: 't1', weight: 0.3 },
  { id: 't2', weight: 0.2 },
];

function subjects(n: number, rate: number, extra: Partial<AnsweredItem> = {}): SubjectInput[] {
  return ['ENG', 'MTH', 'PHY', 'CHM'].map((code) => ({
    code,
    topics,
    items: items(n, rate, extra),
  }));
}

describe('predict', () => {
  it('refuses to predict below the early minimum', () => {
    const res = predict(subjects(3, 0.5), NOW);
    expect(res.status).toBe('need_more_data');
    expect(res.total).toBeNull();
  });

  it('gives an early, wide estimate between 5 and 29 answers per subject', () => {
    const res = predict(subjects(10, 0.6), NOW);
    expect(res.status).toBe('early');
    expect(res.total!.high - res.total!.mid).toBeGreaterThanOrEqual(25);
  });

  it('is ready at 30+ per subject and roughly tracks accuracy', () => {
    const res = predict(subjects(60, 0.6), NOW);
    expect(res.status).toBe('ready');
    expect(res.total!.mid).toBeGreaterThan(200);
    expect(res.total!.mid).toBeLessThan(280);
    const half = res.total!.high - res.total!.mid;
    expect(half).toBeGreaterThanOrEqual(10);
    expect(half).toBeLessThanOrEqual(40);
  });

  it('narrows the range as data grows', () => {
    const small = predict(subjects(30, 0.6), NOW).total!;
    const big = predict(subjects(300, 0.6), NOW).total!;
    expect(big.high - big.low).toBeLessThan(small.high - small.low);
  });

  it('never exceeds 400 or goes below 0', () => {
    expect(predict(subjects(100, 1, { difficulty: 3 }), NOW).total!.high).toBeLessThanOrEqual(400);
    expect(predict(subjects(100, 0), NOW).total!.low).toBeGreaterThanOrEqual(0);
  });

  it('rates the same accuracy on hard questions above easy ones', () => {
    const easy = predict(subjects(60, 0.6, { difficulty: 1 }), NOW).total!.mid;
    const hard = predict(subjects(60, 0.6, { difficulty: 3 }), NOW).total!.mid;
    expect(hard).toBeGreaterThan(easy);
  });

  it('penalises answering slower than exam pace', () => {
    const fast = predict(subjects(60, 0.6, { timed: true, timeMs: 30_000 }), NOW);
    const slow = predict(subjects(60, 0.6, { timed: true, timeMs: 80_000 }), NOW);
    expect(fast.speedFactor).toBe(1);
    expect(slow.speedFactor).toBeCloseTo(0.5);
    expect(slow.total!.mid).toBeLessThan(fast.total!.mid);
  });

  it('weights recent answers double', () => {
    const old = new Date('2027-01-01T00:00:00Z');
    const s = ['ENG', 'MTH', 'PHY', 'CHM'].map((code) => ({
      code,
      topics,
      items: [...items(30, 1, { answeredAt: NOW }), ...items(30, 0, { answeredAt: old })],
    }));
    // 30 right recently (w=2) + 30 wrong long ago (w=1) ⇒ ~67% not 50%.
    expect(predict(s, NOW).perSubject[0]!.estimate).toBeGreaterThan(60);
  });
});

describe('allocateByWeight', () => {
  it('splits proportionally and hits the total', () => {
    const res = allocateByWeight(10, [
      { id: 'a', weight: 0.5, available: 100 },
      { id: 'b', weight: 0.3, available: 100 },
      { id: 'c', weight: 0.2, available: 100 },
    ]);
    expect([...res.values()]).toEqual([5, 3, 2]);
  });

  it('redistributes when a topic runs out', () => {
    const res = allocateByWeight(10, [
      { id: 'a', weight: 0.8, available: 2 },
      { id: 'b', weight: 0.2, available: 100 },
    ]);
    expect(res.get('a')).toBe(2);
    expect(res.get('b')).toBe(8);
  });

  it('handles zero weights and too few questions', () => {
    const res = allocateByWeight(10, [
      { id: 'a', weight: 0, available: 3 },
      { id: 'b', weight: 0, available: 3 },
    ]);
    expect(res.get('a')! + res.get('b')!).toBe(6);
  });

  it('shuffle keeps all items', () => {
    expect(shuffle([1, 2, 3, 4], () => 0.3).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('nextReview', () => {
  it('follows 1 → 3 → 7 → 14 → graduate', () => {
    let state = nextReview(null, false, NOW)!;
    expect(state.intervalDays).toBe(1);
    state = nextReview(state, true, NOW)!;
    expect(state.intervalDays).toBe(3);
    state = nextReview(state, true, NOW)!;
    expect(state.intervalDays).toBe(7);
    state = nextReview(state, true, NOW)!;
    expect(state.intervalDays).toBe(14);
    expect(nextReview(state, true, NOW)).toBeNull();
  });

  it('resets on a wrong answer and ignores correct answers never missed', () => {
    expect(nextReview({ intervalDays: 7 }, false, NOW)!.intervalDays).toBe(1);
    expect(nextReview(null, true, NOW)).toBeNull();
  });
});

describe('buildDailyPlan', () => {
  const base: PlanInput = {
    paid: true,
    hasDiagnostic: true,
    weekday: 2,
    daysToExam: 90,
    dailyMinutes: 40,
    dueReviewCount: 12,
    topics: [
      {
        id: 'm1',
        name: 'Algebra',
        subjectCode: 'MTH',
        weight: 0.2,
        learnability: 1,
        mastery: 0.3,
        available: 50,
      },
      {
        id: 'm2',
        name: 'Calculus',
        subjectCode: 'MTH',
        weight: 0.1,
        learnability: 1,
        mastery: 0.9,
        available: 50,
      },
      {
        id: 'p1',
        name: 'Motion',
        subjectCode: 'PHY',
        weight: 0.15,
        learnability: 1,
        mastery: 0.2,
        available: 50,
      },
      {
        id: 'e1',
        name: 'Comprehension',
        subjectCode: 'ENG',
        weight: 0.3,
        learnability: 1,
        mastery: 0.8,
        available: 50,
      },
    ],
    daysSinceSubject: { ENG: 1, MTH: 1, PHY: 1, CHM: 1 },
    planAgeDays: 3,
    subjects: ['ENG', 'MTH', 'PHY', 'CHM'],
  };

  it('starts with the diagnostic', () => {
    expect(buildDailyPlan({ ...base, hasDiagnostic: false }).map((i) => i.kind)).toEqual([
      'diagnostic',
    ]);
  });

  it('mixes review and the two highest-priority topics from different subjects', () => {
    const plan = buildDailyPlan(base);
    expect(plan[0]!.kind).toBe('review');
    const practice = plan.filter((i) => i.kind === 'practice');
    expect(practice.map((i) => i.topicId)).toEqual(['m1', 'p1']);
  });

  it('puts a stale subject first', () => {
    const plan = buildDailyPlan({ ...base, daysSinceSubject: { ENG: 5, MTH: 1, PHY: 1 } });
    expect(plan.find((i) => i.kind === 'practice')!.subjectCode).toBe('ENG');
  });

  it('runs the mini-mock on Saturday and full mocks in the final two weeks', () => {
    expect(buildDailyPlan({ ...base, weekday: 6 }).map((i) => i.kind)).toEqual(['mini_mock']);
    expect(buildDailyPlan({ ...base, daysToExam: 10 }).map((i) => i.kind)).toEqual([
      'full_mock',
      'review',
    ]);
  });

  it('locks paid items for free users', () => {
    const plan = buildDailyPlan({ ...base, paid: false });
    expect(plan.find((i) => i.kind === 'review')!.locked).toBe(true);
    expect(plan.filter((i) => i.kind === 'practice').every((i) => !i.locked)).toBe(true);
    expect(buildDailyPlan({ ...base, paid: false, weekday: 6 })[0]!.locked).toBe(true);
  });

  it('adds a speed drill every second day after week 2', () => {
    expect(buildDailyPlan({ ...base, planAgeDays: 16 }).some((i) => i.kind === 'speed_drill')).toBe(
      true,
    );
    expect(buildDailyPlan({ ...base, planAgeDays: 17 }).some((i) => i.kind === 'speed_drill')).toBe(
      false,
    );
  });
});
