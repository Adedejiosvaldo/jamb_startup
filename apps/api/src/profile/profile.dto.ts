import { z } from 'zod';
import { normaliseNigerianPhone } from '../common/phone';

export const profilePatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  state: z.string().max(40).optional(),
  examYear: z.number().int().min(2026).max(2035).optional(),
  track: z.enum(['first_timer', 'retaker']).optional(),
  lastUtmeScore: z.number().int().min(0).max(400).nullable().optional(),
  targetUniversityId: z.string().uuid().nullable().optional(),
  targetCourseId: z.string().uuid().nullable().optional(),
  targetScore: z.number().int().min(100).max(400).nullable().optional(),
  dailyMinutes: z.union([z.literal(20), z.literal(40), z.literal(60), z.literal(90)]).optional(),
  deviceType: z.enum(['phone', 'laptop', 'both']).optional(),
});
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export const subjectsSchema = z.object({
  subjectCodes: z
    .array(z.string().toUpperCase())
    .length(3, 'Pick exactly 3 subjects besides English.')
    .refine((c) => new Set(c).size === 3, 'Subjects must be different.')
    .refine((c) => !c.includes('ENG'), 'English is already included.'),
});

export const parentLinkSchema = z.object({
  parentPhone: z.string().transform((v, ctx) => {
    const n = normaliseNigerianPhone(v);
    if (!n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid Nigerian mobile number.',
      });
      return z.NEVER;
    }
    return n;
  }),
});
