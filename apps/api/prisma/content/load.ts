import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { SYLLABUS } from './syllabus';

const L = z.enum(['A', 'B', 'C', 'D']);

/** Same shape the admin bulk importer accepts (minus subjectCode, taken from the file name). */
export const contentQuestionSchema = z.object({
  topicName: z.string(),
  stem: z.string().min(5),
  options: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
  }),
  correctOption: L,
  explanationCorrect: z.string().min(5),
  explanationsWrong: z.record(L, z.string()),
  difficulty: z.number().int().min(1).max(3),
  source: z.enum(['past', 'original', 'variant']).default('original'),
  pastYear: z.number().int().nullable().optional(),
});
export type ContentQuestion = z.infer<typeof contentQuestionSchema> & { subjectCode: string };

/** Loads and validates every questions/<SUBJECT>.json file. Throws listing all problems. */
export function loadContentQuestions(dir = join(__dirname, 'questions')): ContentQuestion[] {
  const out: ContentQuestion[] = [];
  const problems: string[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const subjectCode = file.replace('.json', '');
    const topics = new Set((SYLLABUS[subjectCode] ?? []).map((t) => t.name));
    if (!topics.size) problems.push(`${file}: no syllabus for ${subjectCode}`);
    const rows = JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown[];
    const stems = new Set<string>();
    rows.forEach((raw, i) => {
      const parsed = contentQuestionSchema.safeParse(raw);
      if (!parsed.success) {
        problems.push(
          `${file}#${i + 1}: ${parsed.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`,
        );
        return;
      }
      const q = parsed.data;
      if (!topics.has(q.topicName))
        problems.push(`${file}#${i + 1}: unknown topic "${q.topicName}"`);
      if (q.explanationsWrong[q.correctOption])
        problems.push(`${file}#${i + 1}: explanationsWrong includes the correct option`);
      const wrong = (['A', 'B', 'C', 'D'] as const).filter((l) => l !== q.correctOption);
      for (const l of wrong)
        if (!q.explanationsWrong[l]) problems.push(`${file}#${i + 1}: missing why-wrong for ${l}`);
      // Case-sensitive: stress questions differ only by capitals (PHOtograph vs phoTOgraph).
      const opts = Object.values(q.options).map((o) => o.trim());
      if (new Set(opts).size !== 4) problems.push(`${file}#${i + 1}: duplicate options`);
      if (stems.has(q.stem)) problems.push(`${file}#${i + 1}: duplicate stem`);
      stems.add(q.stem);
      out.push({ ...q, subjectCode });
    });
  }
  if (problems.length) throw new Error(`Content problems:\n  ${problems.join('\n  ')}`);
  return out;
}
