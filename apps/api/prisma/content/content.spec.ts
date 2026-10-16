import { loadContentQuestions } from './load';
import { SYLLABUS } from './syllabus';

describe('content files', () => {
  it('every question is valid, mapped to a syllabus topic and fully explained', () => {
    const qs = loadContentQuestions();
    expect(qs.length).toBeGreaterThanOrEqual(200);
  });

  it('answers are not always the same letter', () => {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    for (const q of loadContentQuestions()) counts[q.correctOption] += 1;
    // Flag a pattern students could game; reviewers should rebalance before launch.
    expect(Math.max(...Object.values(counts))).toBeLessThan(
      0.35 * Object.values(counts).reduce((a, b) => a + b),
    );
  });

  it('syllabus refs are unique per subject', () => {
    for (const [code, topics] of Object.entries(SYLLABUS)) {
      expect(new Set(topics.map((t) => t.ref)).size).toBe(topics.length);
      expect(new Set(topics.map((t) => t.name)).size).toBe(topics.length);
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });
});
