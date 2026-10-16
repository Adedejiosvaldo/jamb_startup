'use client';

import { Flame, Gauge, RotateCcw, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { MasteryBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';
import { useStartTest } from '@/lib/start-test';
import type { Progress } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function PracticePage() {
  const { me } = useSession();
  const progress = useApi<Progress>('/v1/progress');
  const due = useApi<{ due: number; total: number; nextDueAt: string | null }>('/v1/review/due');
  const { start, starting, error } = useStartTest();
  const [subject, setSubject] = useState<string | null>(null);
  const [count, setCount] = useState(15);
  const paid = !!me?.plan.paid;

  const map = progress.data?.masteryMap ?? [];
  const active = subject ?? map[0]?.subjectCode ?? null;
  const topics = useMemo(
    () => map.find((m) => m.subjectCode === active)?.topics ?? [],
    [map, active],
  );
  const name = (code: string) => me?.subjects.find((s) => s.code === code)?.name ?? code;
  const nonEng =
    me?.subjects.find((s) => s.code === 'MTH')?.code ??
    me?.subjects.find((s) => s.code !== 'ENG')?.code ??
    'ENG';

  const quick = [
    {
      key: 'review',
      Icon: RotateCcw,
      title: 'Mistake review',
      body: due.data
        ? due.data.due
          ? `${due.data.due} mistake${due.data.due === 1 ? '' : 's'} due today`
          : 'Nothing due today'
        : '…',
      disabled: paid && !due.data?.due,
      onClick: () => start({ type: 'review' }, 'review'),
    },
    {
      key: 'mini_mock',
      Icon: Gauge,
      title: 'Weekly mini-mock',
      body: '100 questions · 65 min',
      onClick: () => start({ type: 'mini_mock' }, 'mini_mock'),
    },
    {
      key: 'full_mock',
      Icon: Timer,
      title: 'Full CBT mock',
      body: '180 questions · 2 hours',
      onClick: () => start({ type: 'full_mock' }, 'full_mock'),
    },
    {
      key: 'speed_drill',
      Icon: Flame,
      title: `Speed drill (${name(nonEng)})`,
      body: '10 questions at exam pace',
      onClick: () => start({ type: 'speed_drill', subjectCode: nonEng }, 'speed_drill'),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Practice"
        description={
          paid
            ? 'Pick a topic, or use a quick session below.'
            : 'Free plan: 20 practice questions a day with answers.'
        }
      />

      <section aria-labelledby="quick" className="mb-8">
        <h2 id="quick" className="sr-only">
          Quick sessions
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {quick.map((q) => (
            <li key={q.key}>
              <button
                type="button"
                onClick={() => void q.onClick()}
                disabled={q.disabled || starting !== null}
                className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-60"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
                  <q.Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {starting === q.key ? 'Starting…' : q.title}
                  </span>
                  <span className="block text-sm text-slate-600">{q.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </section>

      <section aria-labelledby="topics">
        <h2 id="topics" className="text-lg font-semibold">
          Practise a topic
        </h2>
        {progress.loading ? (
          <Skeleton className="mt-3 h-64" />
        ) : (
          <>
            <div role="tablist" aria-label="Subjects" className="mt-3 flex gap-1 overflow-x-auto">
              {map.map((m) => (
                <button
                  key={m.subjectCode}
                  role="tab"
                  type="button"
                  aria-selected={active === m.subjectCode}
                  onClick={() => setSubject(m.subjectCode)}
                  className={cn(
                    'min-h-11 rounded-lg px-3 text-sm font-medium whitespace-nowrap',
                    active === m.subjectCode
                      ? 'bg-teal-700 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200',
                  )}
                >
                  {name(m.subjectCode)}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <span id="count-label" className="text-slate-600">
                Questions per set:
              </span>
              <div role="group" aria-labelledby="count-label" className="flex gap-1">
                {[10, 15, 25].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={count === n}
                    onClick={() => setCount(n)}
                    className={cn(
                      'min-h-9 min-w-11 rounded-md px-2 font-semibold tabular-nums',
                      count === n ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <ul role="tabpanel" className="mt-4 space-y-2">
              {topics.map((t) => (
                <li key={t.topicId}>
                  <Card className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-pretty">{t.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <MasteryBadge label={t.label} />
                        {t.weight >= 0.2 && (
                          <span className="text-xs text-slate-600">Comes up often</span>
                        )}
                        {t.attempts > 0 && (
                          <span className="text-xs text-slate-600 tabular-nums">
                            {t.attempts} answered
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={starting === t.topicId}
                      onClick={() =>
                        void start({ type: 'practice', topicId: t.topicId, count }, t.topicId)
                      }
                    >
                      Start
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
