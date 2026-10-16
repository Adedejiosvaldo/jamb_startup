'use client';

import { CheckCircle2, Clock, Flame, Lock, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ScoreCard } from '@/components/score-card';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { minutesLabel, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { planItemToBody, useStartTest } from '@/lib/start-test';
import { TEST_LABELS, type PlanItem, type Progress, type TodayPlan } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function HomePage() {
  const { me } = useSession();
  const plan = useApi<TodayPlan>('/v1/plan/today');
  const progress = useApi<Progress>('/v1/progress');
  const open =
    useApi<{ id: string; type: string; startedAt: string; questions: number }[]>('/v1/tests/open');
  const news = useApi<
    {
      id: string;
      title: string;
      body: string;
      officialSourceUrl: string | null;
      publishedAt: string;
    }[]
  >('/v1/announcements', { auth: false });
  const { start, starting, error } = useStartTest();
  const [diagOpen, setDiagOpen] = useState(false);

  const first = me?.name?.split(' ')[0];
  const p = progress.data;
  const done = plan.data?.items.filter((i) => i.completedAt).length ?? 0;
  const total = plan.data?.items.filter((i) => !i.locked).length ?? 0;

  function onItem(item: PlanItem) {
    if (item.kind === 'diagnostic') setDiagOpen(true);
    else void start(planItemToBody(item), item.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-balance">{first ? `Hi ${first}` : 'Today'}</h1>
          {p?.exam.daysLeft != null && (
            <p className="text-slate-600 tabular-nums">
              {p.exam.daysLeft} days to UTME {p.exam.year}
            </p>
          )}
        </div>
        {p && (
          <div
            className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold tabular-nums ring-1 ring-slate-200"
            aria-label={`${p.streak} day streak`}
          >
            <Flame
              aria-hidden="true"
              className={cn('size-4', p.streak ? 'text-amber-600' : 'text-slate-400')}
            />
            {p.streak}
          </div>
        )}
      </div>

      {open.data && open.data.length > 0 && (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">Continue where you stopped</p>
            <p className="text-sm text-slate-600">
              {TEST_LABELS[open.data[0]!.type] ?? 'Test'} · {open.data[0]!.questions} questions
            </p>
          </div>
          <ButtonLink href={`/test/${open.data[0]!.id}`} size="sm">
            Resume
          </ButtonLink>
        </Card>
      )}

      {progress.loading ? (
        <Skeleton className="h-44" />
      ) : p?.prediction ? (
        <Link
          href="/progress"
          className="block rounded-xl focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <ScoreCard prediction={p.prediction} target={p.target} gap={p.gap} compact />
        </Link>
      ) : null}

      <section aria-labelledby="today">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="today" className="text-lg font-semibold">
            Today’s plan
          </h2>
          {plan.data && total > 0 && (
            <p className="text-sm text-slate-600 tabular-nums">
              {done} of {total} done · ~{minutesLabel(plan.data.minutesPlanned)}
            </p>
          )}
        </div>
        {plan.loading && <Skeleton className="h-40" />}
        {plan.error && <Alert tone="danger">{plan.error.message}</Alert>}
        {plan.data?.completedAt && (
          <Alert tone="success" title="Plan done for today" className="mb-3">
            Well done. Rest, or do extra practice if you have time.
          </Alert>
        )}
        <ul className="space-y-3">
          {plan.data?.items.map((item) => (
            <li key={item.id}>
              <Card className={cn('flex items-center gap-3', item.completedAt && 'bg-slate-50')}>
                <span aria-hidden="true" className="shrink-0">
                  {item.completedAt ? (
                    <CheckCircle2 className="size-6 text-green-700" />
                  ) : item.locked ? (
                    <Lock className="size-6 text-slate-400" />
                  ) : (
                    <PlayCircle className="size-6 text-teal-700" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'font-medium text-pretty',
                      item.completedAt && 'text-slate-600 line-through',
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-slate-600 tabular-nums">
                    <Clock aria-hidden="true" className="size-3.5" />~
                    {minutesLabel(item.estMinutes)}
                    {item.count ? ` · ${item.count} questions` : ''}
                    {item.locked && ' · Season Pass'}
                  </p>
                </div>
                {item.locked ? (
                  <ButtonLink href="/upgrade" variant="secondary" size="sm">
                    Unlock
                  </ButtonLink>
                ) : (
                  <Button
                    size="sm"
                    variant={item.completedAt ? 'secondary' : 'primary'}
                    loading={starting === item.id}
                    onClick={() => onItem(item)}
                  >
                    {item.completedAt ? 'Again' : 'Start'}
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
        {error && (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </section>

      {p && (
        <section aria-labelledby="week" className="grid grid-cols-3 gap-3">
          <h2 id="week" className="sr-only">
            This week
          </h2>
          {[
            { label: 'Days this week', value: `${p.week.daysActive}/7` },
            { label: 'Minutes this week', value: p.week.minutes },
            { label: 'Questions this week', value: p.week.questions },
          ].map((s) => (
            <Card key={s.label} className="p-3 text-center">
              <p className="text-xl font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-600">{s.label}</p>
            </Card>
          ))}
        </section>
      )}

      {me && !me.plan.paid && (
        <Card className="space-y-2 border-teal-700">
          <CardTitle>Study with a full plan</CardTitle>
          <p className="text-sm text-pretty text-slate-700">
            Unlimited practice with explanations, mistake review, weekly mocks and a weekly report
            for your parent.
          </p>
          <ButtonLink href="/upgrade" size="sm">
            See the Season Pass
          </ButtonLink>
        </Card>
      )}

      {news.data && news.data.length > 0 && (
        <section aria-labelledby="news" className="space-y-3">
          <h2 id="news" className="text-lg font-semibold">
            Verified updates
          </h2>
          {news.data.slice(0, 2).map((n) => (
            <Card key={n.id}>
              <p className="font-medium text-balance">{n.title}</p>
              <p className="mt-1 text-sm text-pretty text-slate-700">{n.body}</p>
              <p className="mt-2 text-xs text-slate-600">
                {shortDate(n.publishedAt)}
                {n.officialSourceUrl && (
                  <>
                    {' · '}
                    <a
                      className="underline"
                      href={n.officialSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official source
                    </a>
                  </>
                )}
              </p>
            </Card>
          ))}
          <p className="text-xs text-slate-600">If it’s not from JAMB or us, ignore it.</p>
        </section>
      )}

      <Dialog open={diagOpen} onOpenChange={setDiagOpen} title="Choose your diagnostic">
        <div className="space-y-3">
          <Card>
            <p className="font-semibold">Full diagnostic</p>
            <p className="text-sm text-pretty text-slate-600">
              120 questions, 80 minutes. Gives a reliable predicted score.
            </p>
            <Button
              className="mt-3"
              block
              loading={starting === 'diagnostic'}
              onClick={() =>
                void start({ type: 'diagnostic', planItemId: 'diagnostic' }, 'diagnostic')
              }
            >
              Start full test
            </Button>
          </Card>
          <Card>
            <p className="font-semibold">Quick diagnostic</p>
            <p className="text-sm text-pretty text-slate-600">
              31 questions, 20 minutes. An early estimate with a wider range.
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              block
              loading={starting === 'short_diagnostic'}
              onClick={() =>
                void start(
                  { type: 'short_diagnostic', planItemId: 'diagnostic' },
                  'short_diagnostic',
                )
              }
            >
              Start quick test
            </Button>
          </Card>
          <p className="text-sm text-slate-600">
            Your answers save as you go. If your network drops, keep answering.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
