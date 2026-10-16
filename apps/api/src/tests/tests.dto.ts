import { z } from 'zod';

export const createTestSchema = z.object({
  type: z.enum([
    'diagnostic',
    'short_diagnostic',
    'mini_mock',
    'full_mock',
    'practice',
    'speed_drill',
    'review',
  ]),
  topicId: z.string().uuid().optional(),
  subjectCode: z.string().optional(),
  count: z.number().int().min(1).max(50).optional(),
  planItemId: z.string().max(80).optional(),
});
export type CreateTestDto = z.infer<typeof createTestSchema>;

const option = z.enum(['A', 'B', 'C', 'D']).nullable();

export const answerSchema = z.object({
  chosenOption: option,
  timeSpentMs: z
    .number()
    .int()
    .min(0)
    .max(4 * 60 * 60 * 1000)
    .optional(),
  flagged: z.boolean().optional(),
  answeredAt: z.coerce.date().optional(),
});
export type AnswerDto = z.infer<typeof answerSchema>;

export const syncSchema = z.object({
  items: z.array(answerSchema.extend({ position: z.number().int().min(1) })).max(500),
});
export type SyncDto = z.infer<typeof syncSchema>;
