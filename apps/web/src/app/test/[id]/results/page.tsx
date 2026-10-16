'use client';

import { ArrowLeft, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Explanation } from '@/components/cbt/explanation';
import { ReportQuestion } from '@/components/cbt/report-question';
import { ScoreCard } from '@/components/score-card';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { clock, pct } from '@/lib/format';
import { useRequireAuth } from '@/lib/session';
import { useStartTest } from '@/lib/start-test';
import { TEST_LABELS, type OptionKey, type TestResults } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Filter = 'wrong' | 'all' | 'unanswered';

export default function ResultsPage() {
  const session = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<TestResults>(`/v1/tests/${id}/review`);
  const { start, starting, error: startError } = useStartTest();
  const [filter, setFilter] = useState<Filter>('wrong');
  const [limit, setLimit] = useState(10);

  const shown = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.items;
    if (filter === 'unanswered') return data.items.filter((i) => !i.chosenOption);
    return data.items.filter((i) => !i.isCorrect);
  }, [data, filter]);

  if (loading || session.loading) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-4 py-8">
        <PageSkeleton />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-4 py-8">
        <Alert tone="danger">{error?.message ?? 'Results not found.'}</Alert>
      </main>
    );
  }

  const score = data.score;
  const wrongCount = data.items.filter((i) => !i.isCorrect).length;
  const unanswered = data.items.filter((i) => !i.chosenOption).length;
  const isDiagnostic = data.test.type === 'diagnostic' || data.test.type === 'short_diagnostic';
  const paid = session.me?.plan.paid;
  const target = session.me?.profile?.targetScore ?? null;

  return (
    <main id="main" className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <Link
        href="/home"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-slate-700"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to today
      </Link>

      <header>
        <p className="text-sm font-medium text-slate-600">
          {TEST_LABELS[data.test.type] ?? 'Test'} results
        </p>
        <h1 className="mt-1 text-3xl font-bold tabular-nums">
          {score.correct} / {score.total} correct
        </h1>
        <p className="text-slate-600 tabular-nums">
          {pct(score.total ? score.correct / score.total : 0)}
          {data.test.durationSeconds ? ` · ${clock(data.test.durationSeconds)} taken` : ''}
        </p>
      </header>

      {data.prediction ? (
        <ScoreCard
          prediction={data.prediction}
          target={target}
          gap={target ? Math.max(0, target - data.prediction.mid) : null}
        />
      ) : (
        isDiagnostic && (
          <Alert tone="info" title="Not enough answers for a prediction yet">
            Answer a few more questions in every subject and your predicted score will appear.
          </Alert>
        )
      )}

      {score.perSubject.length > 1 && (
        <Card>
          <CardTitle>By subject</CardTitle>
          <ul className="mt-3 space-y-3">
            {score.perSubject.map((s) => (
              <li key={s.code}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular-nums">
                    {s.correct}/{s.total} · {s.scaled}%
                  </span>
                </div>
                <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-teal-700" style={{ width: `${s.scaled}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.weakestTopics.length > 0 && (
        <Card>
          <CardTitle>Work on these next</CardTitle>
          <ul className="mt-3 divide-y divide-slate-100">
            {data.weakestTopics.map((t) => (
              <li key={t.topicId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-pretty">{t.name}</p>
                  <p className="text-sm text-slate-600 tabular-nums">
                    {t.subjectCode} · {t.correct}/{t.total} right
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={starting === t.topicId}
                  onClick={() => void start({ type: 'practice', topicId: t.topicId }, t.topicId)}
                >
                  Practise
                </Button>
              </li>
            ))}
          </ul>
          {startError && (
            <Alert tone="danger" className="mt-2">
              {startError}
            </Alert>
          )}
        </Card>
      )}

      {isDiagnostic && !paid && (
        <Card className="space-y-2 border-2 border-teal-700">
          <CardTitle>Close the gap with a daily plan</CardTitle>
          <p className="text-sm text-pretty text-slate-700">
            The Season Pass builds your plan around these weak topics, explains every mistake, and
            brings errors back until you get them right.
          </p>
          <ButtonLink href="/upgrade">See the Season Pass</ButtonLink>
        </Card>
      )}

      <section aria-labelledby="review">
        <h2 id="review" className="text-lg font-semibold">
          Review your answers
        </h2>
        <div role="group" aria-label="Show" className="mt-3 flex gap-2">
          {(
            [
              ['wrong', `Wrong (${wrongCount})`],
              ['unanswered', `Blank (${unanswered})`],
              ['all', `All (${data.items.length})`],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'primary' : 'secondary'}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {label}
            </Button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="mt-4 text-slate-600">Nothing here. Nice work.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {shown.slice(0, limit).map((it) => (
              <li key={it.position}>
                <Card className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-600 tabular-nums">
                      Q{it.position} · {it.subjectCode} · {it.topicName}
                    </p>
                    {it.isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-800">
                        <Check aria-hidden="true" className="size-4" /> Right
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-800">
                        <X aria-hidden="true" className="size-4" />{' '}
                        {it.chosenOption ? 'Wrong' : 'Blank'}
                      </span>
                    )}
                  </div>
                  <p className="text-pretty whitespace-pre-line">{it.stem}</p>
                  <ul className="space-y-1.5 text-sm">
                    {(Object.keys(it.options) as OptionKey[]).map((k) => (
                      <li
                        key={k}
                        className={cn(
                          'rounded-md px-2 py-1.5',
                          k === it.correctOption
                            ? 'bg-green-50 font-medium text-green-900'
                            : k === it.chosenOption
                              ? 'bg-red-50 text-red-900'
                              : 'text-slate-700',
                        )}
                      >
                        <span className="font-semibold">{k}.</span> {it.options[k]}
                        {k === it.correctOption && ' — correct answer'}
                        {k === it.chosenOption && k !== it.correctOption && ' — your answer'}
                      </li>
                    ))}
                  </ul>
                  {!it.isCorrect && (
                    <Explanation
                      correctOption={it.correctOption}
                      chosenOption={it.chosenOption}
                      explanationCorrect={it.explanationCorrect}
                      explanationsWrong={it.explanationsWrong}
                      locked={data.explanationsLocked}
                    />
                  )}
                  <ReportQuestion questionId={it.questionId} />
                </Card>
              </li>
            ))}
          </ol>
        )}
        {shown.length > limit && (
          <Button
            variant="secondary"
            block
            className="mt-4"
            onClick={() => setLimit((l) => l + 10)}
          >
            Show more ({shown.length - limit} left)
          </Button>
        )}
      </section>

      <ButtonLink href="/home" block>
        Back to today’s plan
      </ButtonLink>
    </main>
  );
}
