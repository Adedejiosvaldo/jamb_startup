import { z } from 'zod';

/**
 * Shape of course_requirements.utme_subjects.
 * Example — Medicine: English + Biology + Chemistry + Physics →
 *   { required: ['ENG','BIO','CHM','PHY'], choose: [] }
 * Example — Economics: English + Maths + Economics + one of Government/Geography/… →
 *   { required: ['ENG','MTH','ECO'], choose: [{ count: 1, from: ['GOV','GEO','ACC'] }] }
 */
export const utmeSubjectsSchema = z.object({
  required: z.array(z.string().min(2).max(8)).min(1),
  choose: z
    .array(
      z.object({ count: z.number().int().min(1), from: z.array(z.string().min(2).max(8)).min(1) }),
    )
    .default([]),
});
export type UtmeSubjects = z.infer<typeof utmeSubjectsSchema>;

/** Checks a student's 4 subjects against a requirement. Returns human-readable problems. */
export function checkCombination(
  req: UtmeSubjects,
  chosen: string[],
): { ok: boolean; problems: string[] } {
  const set = new Set(chosen);
  const problems: string[] = [];
  for (const code of req.required) {
    if (!set.has(code)) problems.push(`Missing required subject ${code}`);
  }
  for (const group of req.choose) {
    const have = group.from.filter((c) => set.has(c)).length;
    if (have < group.count) problems.push(`Choose ${group.count} of ${group.from.join(', ')}`);
  }
  return { ok: problems.length === 0, problems };
}
