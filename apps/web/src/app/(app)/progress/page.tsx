'use client';

import { ScoreCard } from '@/components/score-card';
import { TrendChart } from '@/components/trend-chart';
import { MasteryBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { minutesLabel } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Prediction, Progress } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function ProgressPage() {
  const { me } = useSession();
  const progress = useApi<Progress>('/v1/progress');
  const history = useApi<Prediction[]>('/v1/predictions/history');
  const p = progress.data;
  const name = (code: string) => me?.subjects.find((s) => s.code === code)?.name ?? code;

  if (progress.loading || history.loading) return <PageSkeleton />;
  if (!p) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Progress" />

      {p.prediction ? (
        <ScoreCard prediction={p.prediction} target={p.target} gap={p.gap} />
      ) : (
        <Empty
          title="No predicted score yet"
          action={<ButtonLink href="/home">Take the diagnostic</ButtonLink>}
        >
          Your predicted score appears after your first diagnostic or mock.
        </Empty>
      )}

      {history.data && history.data.length > 0 && (
        <Card>
          <CardTitle>Predicted score over time</CardTitle>
          <p className="text-sm text-slate-600">
            Updates after each diagnostic and mock. The shaded band is the likely range.
          </p>
          <div className="mt-3">
            <TrendChart history={history.data} target={p.target} />
          </div>
        </Card>
      )}

      {p.prediction && (
        <Card>
          <CardTitle>By subject</CardTitle>
          <ul className="mt-3 space-y-2">
            {p.prediction.perSubject.map((s) => (
              <li key={s.code} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{name(s.code)}</span>
                <span className="text-slate-700 tabular-nums">
                  {s.estimate !== null ? `~${s.estimate} / 100` : 'Need more answers'}
                  {s.status === 'early' && ' · early'}
                  <span className="text-slate-500"> · {s.answered} answered</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="habits" className="grid grid-cols-3 gap-3">
        <h2 id="habits" className="sr-only">
          Study habits
        </h2>
        {[
          { label: 'Day streak', value: p.streak },
          { label: 'Days this week', value: `${p.week.daysActive}/7` },
          { label: 'This week', value: minutesLabel(p.week.minutes) },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <p className="text-xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-slate-600">{s.label}</p>
          </Card>
        ))}
      </section>

      <section aria-labelledby="mastery" className="space-y-4">
        <h2 id="mastery" className="text-lg font-semibold">
          Topic mastery
        </h2>
        {p.masteryMap.map((m) => (
          <Card key={m.subjectCode}>
            <CardTitle>{name(m.subjectCode)}</CardTitle>
            <ul className="mt-3 divide-y divide-slate-100">
              {m.topics.map((t) => (
                <li
                  key={t.topicId}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 text-pretty">{t.name}</span>
                  <MasteryBadge label={t.label} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>
    </div>
  );
}
