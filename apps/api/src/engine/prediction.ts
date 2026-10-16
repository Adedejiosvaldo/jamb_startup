import { EXAM_PACE_MS, PREDICTION as P } from './engine.config';

export interface AnsweredItem {
  topicId: string;
  correct: boolean;
  difficulty: number;
  answeredAt: Date;
  /** Time spent; only meaningful when `timed`. */
  timeMs?: number | null;
  timed: boolean;
}

export interface SubjectInput {
  code: string;
  /** All topics in the subject with their exam weight (share of past questions). */
  topics: { id: string; weight: number }[];
  items: AnsweredItem[];
}

export type SubjectStatus = 'ready' | 'early' | 'need_more_data';

export interface SubjectPrediction {
  code: string;
  answered: number;
  status: SubjectStatus;
  /** 0–100, null when need_more_data. */
  estimate: number | null;
  halfWidth: number | null;
  accuracy: number | null;
}

export interface PredictionResult {
  status: SubjectStatus;
  total: { low: number; mid: number; high: number } | null;
  perSubject: SubjectPrediction[];
  speedFactor: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Prediction engine v1 (spec §6.2): topic-weighted, recency- and
 * difficulty-weighted accuracy per subject, scaled to 100, with an honest
 * range that narrows as more questions are answered.
 */
export function predict(subjects: SubjectInput[], now = new Date()): PredictionResult {
  const recencyCutoff = now.getTime() - P.recencyDays * 24 * 60 * 60 * 1000;

  const timed = subjects.flatMap((s) => s.items).filter((i) => i.timed && i.timeMs && i.timeMs > 0);
  let speedFactor = 1;
  if (timed.length >= P.speedMinTimedItems) {
    const avg = timed.reduce((sum, i) => sum + (i.timeMs ?? 0), 0) / timed.length;
    // Slower than exam pace ⇒ they'd run out of time and leave the rest blank.
    if (avg > EXAM_PACE_MS) speedFactor = EXAM_PACE_MS / avg;
  }

  const perSubject = subjects.map((s): SubjectPrediction => {
    const n = s.items.length;
    if (n < P.earlyMinPerSubject) {
      return {
        code: s.code,
        answered: n,
        status: 'need_more_data',
        estimate: null,
        halfWidth: null,
        accuracy: null,
      };
    }

    const weightOf = (i: AnsweredItem) =>
      (i.answeredAt.getTime() >= recencyCutoff ? P.recencyWeight : 1) *
      (P.difficultyWeight[i.difficulty] ?? 1);

    let num = 0;
    let den = 0;
    const byTopic = new Map<string, { num: number; den: number }>();
    for (const i of s.items) {
      const w = weightOf(i);
      num += w * (i.correct ? 1 : 0);
      den += w;
      const t = byTopic.get(i.topicId) ?? { num: 0, den: 0 };
      t.num += w * (i.correct ? 1 : 0);
      t.den += w;
      byTopic.set(i.topicId, t);
    }
    const overall = den > 0 ? num / den : 0;

    // Topic accuracy shrunk toward the subject's overall; unseen topics assume overall.
    const topics = s.topics.length
      ? s.topics
      : [...byTopic.keys()].map((id) => ({ id, weight: 0 }));
    const totalWeight = topics.reduce((sum, t) => sum + t.weight, 0);
    const useUniform = totalWeight <= 0;
    let acc = 0;
    let wSum = 0;
    for (const t of topics) {
      const w = useUniform ? 1 : t.weight;
      const obs = byTopic.get(t.id);
      const a = obs ? (obs.num + P.topicShrink * overall) / (obs.den + P.topicShrink) : overall;
      acc += w * a;
      wSum += w;
    }
    acc = wSum > 0 ? acc / wSum : overall;

    // Difficulty mix correction relative to an assumed medium (2) exam.
    const meanDifficulty = s.items.reduce((sum, i) => sum + i.difficulty, 0) / n;
    acc = clamp(acc * (1 - P.difficultyCorrection * (2 - meanDifficulty)), 0, 1);

    const estimate = 100 * acc * speedFactor;
    return {
      code: s.code,
      answered: n,
      status: n >= P.readyMinPerSubject ? 'ready' : 'early',
      estimate: Math.round(estimate),
      halfWidth: P.rangeK / Math.sqrt(n),
      accuracy: overall,
    };
  });

  const missing = perSubject.some((p) => p.status === 'need_more_data');
  if (missing) return { status: 'need_more_data', total: null, perSubject, speedFactor };

  const anyEarly = perSubject.some((p) => p.status === 'early');
  const mid = clamp(Math.round(perSubject.reduce((sum, p) => sum + (p.estimate ?? 0), 0)), 0, 400);
  const combined = Math.sqrt(perSubject.reduce((sum, p) => sum + (p.halfWidth ?? 0) ** 2, 0));
  const half = Math.round(
    clamp(combined, anyEarly ? P.earlyRangeFloor : P.rangeFloor, P.rangeCeiling),
  );
  return {
    status: anyEarly ? 'early' : 'ready',
    total: { low: clamp(mid - half, 0, 400), mid, high: clamp(mid + half, 0, 400) },
    perSubject: perSubject.map((p) => ({
      ...p,
      halfWidth: p.halfWidth && Math.round(p.halfWidth),
    })),
    speedFactor,
  };
}
