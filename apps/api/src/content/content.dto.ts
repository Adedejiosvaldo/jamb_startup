import { z } from 'zod';

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

const options = z.object({
  A: z.string().min(1),
  B: z.string().min(1),
  C: z.string().min(1),
  D: z.string().min(1),
});

const base = z.object({
  stem: z.string().min(5),
  options,
  correctOption: z.enum(OPTION_KEYS),
  explanationCorrect: z.string().optional(),
  /** Why each wrong option is wrong, keyed by option letter (F-PRAC-04). */
  explanationsWrong: z.record(z.enum(OPTION_KEYS), z.string()).optional(),
  difficulty: z.number().int().min(1).max(3).default(2),
  source: z.enum(['past', 'original', 'variant']),
  pastYear: z.number().int().min(1978).max(2100).nullable().optional(),
});

export const questionCreateSchema = base.extend({ topicId: z.string().uuid() });
export type QuestionCreate = z.infer<typeof questionCreateSchema>;

export const questionPatchSchema = base.partial().extend({ topicId: z.string().uuid().optional() });
export type QuestionPatch = z.infer<typeof questionPatchSchema>;

/** Bulk import row: topic by subject code + topic name, so content teams can work in spreadsheets. */
export const importRowSchema = base.extend({ subjectCode: z.string(), topicName: z.string() });
export const importSchema = z.object({ rows: z.array(z.unknown()).min(1).max(2000) });

export const questionListQuery = z.object({
  subject: z.string().optional(),
  topicId: z.string().uuid().optional(),
  status: z.enum(['draft', 'reviewed', 'live', 'flagged', 'retired']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional(),
});

export const reportSchema = z.object({
  reason: z.enum(['wrong_answer', 'typo', 'unclear', 'wrong_explanation', 'other']),
  note: z.string().max(1000).optional(),
});

export const resolveReportSchema = z.object({
  decision: z.enum(['confirmed', 'rejected']),
  /** Reward the reporter with extra days on their plan (F-SUP-03). */
  rewardDays: z.number().int().min(0).max(30).default(0),
});

export const FLAG_THRESHOLD = 3;
