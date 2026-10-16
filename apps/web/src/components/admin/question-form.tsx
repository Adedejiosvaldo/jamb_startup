'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, SelectField, TextareaField } from '@/components/ui/field';
import type { OptionKey, Subject } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export interface QuestionInput {
  topicId: string;
  stem: string;
  options: Record<OptionKey, string>;
  correctOption: OptionKey;
  explanationCorrect?: string;
  explanationsWrong?: Partial<Record<OptionKey, string>>;
  difficulty: number;
  source: 'past' | 'original' | 'variant';
  pastYear?: number | null;
}

const LETTERS: OptionKey[] = ['A', 'B', 'C', 'D'];

export function QuestionForm({
  initial,
  initialSubject,
  onSubmit,
  busy,
  submitLabel,
}: {
  initial?: Partial<QuestionInput>;
  initialSubject?: string;
  onSubmit: (q: QuestionInput) => void;
  busy: boolean;
  submitLabel: string;
}) {
  const subjects = useApi<Subject[]>('/v1/subjects', { auth: false });
  const [subject, setSubject] = useState(initialSubject ?? '');
  const topics = useApi<{ id: string; name: string }[]>(
    subject ? `/v1/subjects/${subject}/topics` : null,
    { auth: false },
  );
  const [q, setQ] = useState<QuestionInput>({
    topicId: initial?.topicId ?? '',
    stem: initial?.stem ?? '',
    options: initial?.options ?? { A: '', B: '', C: '', D: '' },
    correctOption: initial?.correctOption ?? 'A',
    explanationCorrect: initial?.explanationCorrect ?? '',
    explanationsWrong: initial?.explanationsWrong ?? {},
    difficulty: initial?.difficulty ?? 2,
    source: initial?.source ?? 'original',
    pastYear: initial?.pastYear ?? null,
  });
  const set = <K extends keyof QuestionInput>(k: K, v: QuestionInput[K]) =>
    setQ((cur) => ({ ...cur, [k]: v }));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const wrong = Object.fromEntries(
          Object.entries(q.explanationsWrong ?? {}).filter(([k, v]) => v && k !== q.correctOption),
        );
        onSubmit({
          ...q,
          explanationCorrect: q.explanationCorrect || undefined,
          explanationsWrong: wrong,
          pastYear: q.source === 'past' ? q.pastYear : null,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Subject"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            set('topicId', '');
          }}
          required
        >
          <option value="">Choose…</option>
          {subjects.data?.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Topic"
          value={q.topicId}
          onChange={(e) => set('topicId', e.target.value)}
          required
          disabled={!subject}
        >
          <option value="">Choose…</option>
          {topics.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      </div>
      <TextareaField
        label="Question"
        value={q.stem}
        onChange={(e) => set('stem', e.target.value)}
        required
        minLength={5}
      />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Options — tick the correct one</legend>
        {LETTERS.map((l) => (
          <div key={l} className="flex items-start gap-3">
            <label className="mt-2.5 flex min-h-11 items-start gap-2 text-sm font-semibold">
              <input
                type="radio"
                name="correct"
                className="mt-1 size-4 accent-teal-700"
                checked={q.correctOption === l}
                onChange={() => set('correctOption', l)}
              />
              {l}
              <span className="sr-only"> is correct</span>
            </label>
            <div className="flex-1 space-y-2">
              <Field
                label={`Option ${l}`}
                className="[&_label]:sr-only"
                value={q.options[l]}
                onChange={(e) => set('options', { ...q.options, [l]: e.target.value })}
                required
              />
              {q.correctOption !== l && (
                <Field
                  label={`Why ${l} is wrong`}
                  className="[&_label]:text-xs [&_label]:font-normal [&_label]:text-slate-600"
                  value={q.explanationsWrong?.[l] ?? ''}
                  onChange={(e) =>
                    set('explanationsWrong', { ...q.explanationsWrong, [l]: e.target.value })
                  }
                />
              )}
            </div>
          </div>
        ))}
      </fieldset>
      <TextareaField
        label={`Why ${q.correctOption} is right`}
        hint="Required before a reviewer can approve."
        value={q.explanationCorrect ?? ''}
        onChange={(e) => set('explanationCorrect', e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Difficulty"
          value={q.difficulty}
          onChange={(e) => set('difficulty', Number(e.target.value))}
        >
          <option value={1}>Easy</option>
          <option value={2}>Medium</option>
          <option value={3}>Hard</option>
        </SelectField>
        <SelectField
          label="Source"
          value={q.source}
          onChange={(e) => set('source', e.target.value as QuestionInput['source'])}
        >
          <option value="original">Original (written by us)</option>
          <option value="past">Past JAMB question</option>
          <option value="variant">Variant of another question</option>
        </SelectField>
        {q.source === 'past' && (
          <Field
            label="Year"
            inputMode="numeric"
            value={q.pastYear ?? ''}
            onChange={(e) => set('pastYear', Number(e.target.value) || null)}
          />
        )}
      </div>
      <Button type="submit" loading={busy} disabled={!q.topicId}>
        {submitLabel}
      </Button>
    </form>
  );
}
