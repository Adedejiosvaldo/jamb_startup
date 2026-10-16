'use client';

import {
  ArrowRight,
  Check,
  Clock,
  Flame,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ScoreCard } from '@/components/score-card';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { minutesLabel, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { planItemToBody, useStartTest } from '@/lib/start-test';
import { TEST_LABELS, type PlanItem, type Progress, type TodayPlan } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const KIND_ICON = {
  diagnostic: Zap,
  practice: Play,
  review: RotateCcw,
  mini_mock: Clock,
  full_mock: Clock,
  speed_drill: Zap,
} as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function HomePage() {
  const { me } = useSession();
  const plan = useApi<TodayPlan>('/v1/plan/today');
  const progress = useApi<Progress>('/v1/progress');
  const open = useApi<{ id: string; type: string; questions: number }[]>('/v1/tests/open');
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
  const items = plan.data?.items ?? [];
  const unlocked = items.filter((i) => !i.locked);
  const done = unlocked.filter((i) => i.completedAt).length;
  const pct = unlocked.length ? (done / unlocked.length) * 100 : 0;
  const resume = open.data?.[0];

  function onItem(item: PlanItem) {
    if (item.kind === 'diagnostic') setDiagOpen(true);
    else void start(planItemToBody(item), item.id);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{greeting()}</p>
          <h1 className="text-3xl font-semibold text-balance">{first ?? 'Welcome'}</h1>
        </div>
        <div className="flex gap-2">
          {p?.exam.daysLeft != null && (
            <div className="rounded-2xl border border-line bg-white/[0.03] px-3 py-2 text-center">
              <p className="text-lg leading-none font-semibold tabular-nums">{p.exam.daysLeft}</p>
              <p className="mt-1 text-[10px] text-muted uppercase">days left</p>
            </div>
          )}
          {p && (
            <div
              className="rounded-2xl border border-line bg-white/[0.03] px-3 py-2 text-center"
              aria-label={`${p.streak} day streak`}
            >
              <p className="flex items-center justify-center gap-1 text-lg leading-none font-semibold tabular-nums">
                <Flame
                  aria-hidden="true"
                  className={cn('size-4', p.streak ? 'text-amber-400' : 'text-faint')}
                />
                {p.streak}
              </p>
              <p className="mt-1 text-[10px] text-muted uppercase">streak</p>
            </div>
          )}
        </div>
      </header>

      {resume && (
        <Link
          href={`/test/${resume.id}`}
          className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 hover:bg-amber-500/15 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Play aria-hidden="true" className="size-5 shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">
              Resume {TEST_LABELS[resume.type]?.toLowerCase() ?? 'test'}
            </span>
            <span className="block text-sm text-amber-200/70">
              {resume.questions} questions · answers saved
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="size-4 text-amber-300" />
        </Link>
      )}

      {progress.loading ? (
        <Skeleton className="h-64" />
      ) : p?.prediction ? (
        <Link
          href="/progress"
          className="block rounded-3xl focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ScoreCard prediction={p.prediction} target={p.target} gap={p.gap} compact />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setDiagOpen(true)}
          className="glass group relative w-full overflow-hidden rounded-3xl border border-line p-6 text-left focus-visible:outline-2 focus-visible:outline-accent"
        >
          <div
            aria-hidden="true"
            className="absolute -top-16 -right-16 size-48 rounded-full bg-emerald-500/20 blur-3xl"
          />
          <div className="relative flex items-center gap-5">
            <div
              aria-hidden="true"
              className="grid size-24 shrink-0 place-items-center rounded-full border-[6px] border-dashed border-white/10"
            >
              <span className="text-2xl font-semibold text-faint">?</span>
            </div>
            <div>
              <p className="text-lg font-semibold text-balance">What would you score today?</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent">
                Find out in 20 minutes <ArrowRight aria-hidden="true" className="size-4" />
              </p>
            </div>
          </div>
        </button>
      )}

      <section aria-labelledby="today" className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 id="today" className="text-lg font-semibold">
            Today
          </h2>
          {plan.data && unlocked.length > 0 && (
            <p className="text-sm text-muted tabular-nums">
              {done}/{unlocked.length} · {minutesLabel(plan.data.minutesPlanned)}
            </p>
          )}
        </div>
        {unlocked.length > 0 && (
          <div aria-hidden="true" className="h-1.5 rounded-full bg-white/[0.06]">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
        )}
        {plan.loading && <Skeleton className="h-40" />}
        {plan.error && <Alert tone="danger">{plan.error.message}</Alert>}
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = item.completedAt ? Check : item.locked ? Lock : KIND_ICON[item.kind];
            const body = (
              <>
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl',
                    item.completedAt
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : item.locked
                        ? 'bg-white/[0.04] text-faint'
                        : 'bg-accent-soft text-accent',
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate font-medium',
                      item.completedAt && 'text-muted line-through',
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="block text-sm text-muted tabular-nums">
                    {minutesLabel(item.estMinutes)}
                    {item.count ? ` · ${item.count} questions` : ''}
                  </span>
                </span>
                {item.locked ? (
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-emerald-300">
                    Pass
                  </span>
                ) : starting === item.id ? (
                  <span className="text-sm text-muted">Starting…</span>
                ) : (
                  <ArrowRight aria-hidden="true" className="size-4 text-muted" />
                )}
              </>
            );
            const cls =
              'flex w-full items-center gap-3 rounded-2xl border border-line bg-white/[0.02] p-3 text-left transition-colors duration-150 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-accent';
            return (
              <li key={item.id}>
                {item.locked ? (
                  <Link
                    href="/upgrade"
                    className={cls}
                    aria-label={`${item.title} — needs Season Pass`}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cls}
                    onClick={() => onItem(item)}
                    disabled={starting !== null}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {plan.data?.completedAt && <Alert tone="success">Done for today. Nice work.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
      </section>

      {p && (
        <section aria-label="This week" className="grid grid-cols-3 gap-2">
          {[
            { label: 'Days', value: `${p.week.daysActive}/7` },
            { label: 'Minutes', value: p.week.minutes },
            { label: 'Questions', value: p.week.questions },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-white/[0.02] p-3">
              <p className="text-xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted">{s.label} this week</p>
            </div>
          ))}
        </section>
      )}

      {me && !me.plan.paid && (
        <Link
          href="/upgrade"
          className="relative block overflow-hidden rounded-3xl border border-emerald-400/25 p-5 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent"
          />
          <p className="relative flex items-center gap-2 font-semibold">
            <Sparkles aria-hidden="true" className="size-4 text-accent" /> Season Pass
          </p>
          <p className="relative mt-1 text-sm text-fg-2">
            Full plan, explanations, mistake review, weekly mocks.
          </p>
          <p className="relative mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
            See what’s included <ArrowRight aria-hidden="true" className="size-4" />
          </p>
        </Link>
      )}

      {news.data && news.data.length > 0 && (
        <section aria-labelledby="news" className="space-y-2">
          <h2 id="news" className="text-sm font-medium text-muted">
            Verified updates
          </h2>
          {news.data.slice(0, 2).map((n) => (
            <details
              key={n.id}
              className="group rounded-2xl border border-line bg-white/[0.02] p-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-medium text-balance">{n.title}</span>
                <span className="text-xs text-muted">{shortDate(n.publishedAt)}</span>
              </summary>
              <p className="mt-2 text-sm text-pretty text-muted">
                {n.body}{' '}
                {n.officialSourceUrl && (
                  <a
                    className="text-accent underline"
                    href={n.officialSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source
                  </a>
                )}
              </p>
            </details>
          ))}
        </section>
      )}

      <Dialog open={diagOpen} onOpenChange={setDiagOpen} title="Find your score">
        <div className="space-y-3">
          {[
            {
              type: 'diagnostic' as const,
              title: 'Full diagnostic',
              meta: '120 questions · 80 min',
              note: 'Most accurate',
              primary: true,
            },
            {
              type: 'short_diagnostic' as const,
              title: 'Quick check',
              meta: '31 questions · 20 min',
              note: 'Wider range',
              primary: false,
            },
          ].map((d) => (
            <button
              key={d.type}
              type="button"
              disabled={starting !== null}
              onClick={() => void start({ type: d.type, planItemId: 'diagnostic' }, d.type)}
              className={cn(
                'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent',
                d.primary
                  ? 'border-emerald-400/40 bg-accent-soft hover:bg-emerald-400/15'
                  : 'border-line bg-white/[0.03] hover:bg-white/[0.06]',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{d.title}</span>
                <span className="block text-sm text-muted tabular-nums">{d.meta}</span>
              </span>
              <span
                className={cn('text-xs font-medium', d.primary ? 'text-emerald-300' : 'text-muted')}
              >
                {starting === d.type ? 'Starting…' : d.note}
              </span>
            </button>
          ))}
          <p className="pt-1 text-center text-xs text-muted">
            Answers save as you go — even offline.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
