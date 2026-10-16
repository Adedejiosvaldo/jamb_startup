'use client';

import { CheckCircle2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { TrendChart } from '@/components/trend-chart';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/api';
import { minutesLabel } from '@/lib/format';
import type { Prediction } from '@/lib/types';
import { useApi } from '@/lib/use-api';

interface LinkInfo {
  studentFirstName: string | null;
  optedIn: boolean;
  optedOut: boolean;
}
interface Report {
  studentFirstName: string;
  week: { daysActive: number; minutes: number; questions: number };
  prediction: {
    previous: number | null;
    latest: number | null;
    low: number | null;
    high: number | null;
  };
  biggestImprovement: string | null;
  target: { course: string | null; university: string | null; score: number | null };
  history: { totalLow: number; totalMid: number; totalHigh: number; createdAt: string }[];
}

/** F-ACC-04 opt-in + F-PAR-04 no-login report page. */
export default function ParentPage() {
  const { token } = useParams<{ token: string }>();
  const info = useApi<LinkInfo>(`/v1/parent/link/${token}`, { auth: false });
  const optedIn = info.data?.optedIn;
  const report = useApi<Report>(optedIn ? `/v1/parent/report/${token}` : null, { auth: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: 'opt-in' | 'opt-out') {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/parent/link/${token}/${path}`, { method: 'POST', auth: false });
      await info.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (info.loading) return <PageSkeleton />;
  if (info.error || !info.data)
    return <Alert tone="danger">{info.error?.message ?? 'This link is not valid.'}</Alert>;
  const child = info.data.studentFirstName ?? 'Your child';

  if (!optedIn) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-balance">
          Weekly JAMB progress reports for {child}
        </h1>
        <p className="text-pretty text-fg-2">
          {child} is preparing for JAMB with ScoreCoach and would like you to get one short WhatsApp
          message every Sunday: days studied, minutes, how the predicted score moved, and what
          improved. No other messages except important exam dates you can turn off.
        </p>
        {info.data.optedOut && (
          <Alert tone="info">You stopped these reports. You can turn them back on below.</Alert>
        )}
        <Button block size="lg" loading={busy} onClick={() => void act('opt-in')}>
          Yes, send me reports
        </Button>
        <p className="text-sm text-muted">
          You can stop at any time by replying STOP or using this page. We never share your number.
          Not affiliated with JAMB.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    );
  }

  const r = report.data;
  const history: Prediction[] =
    r?.history.map((h, i) => ({
      id: String(i),
      low: h.totalLow,
      mid: h.totalMid,
      high: h.totalHigh,
      createdAt: h.createdAt,
      status: 'ready',
      speedFactor: 1,
      perSubject: [],
      engineVersion: '',
    })) ?? [];
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1 text-sm font-medium text-emerald-300">
          <CheckCircle2 aria-hidden="true" className="size-4" /> You’re receiving weekly reports
        </p>
        <h1 className="mt-1 text-2xl font-bold text-balance">{child}’s JAMB progress</h1>
      </div>
      {report.loading && <PageSkeleton />}
      {r && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Days this week', value: `${r.week.daysActive}/7` },
              { label: 'Study time', value: minutesLabel(r.week.minutes) },
              { label: 'Questions', value: r.week.questions },
            ].map((s) => (
              <Card key={s.label} className="p-3 text-center">
                <p className="text-xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </Card>
            ))}
          </div>
          <Card className="space-y-2">
            <CardTitle>Predicted JAMB score</CardTitle>
            {r.prediction.latest !== null ? (
              <>
                <p className="text-3xl font-bold tabular-nums">
                  {r.prediction.low}–{r.prediction.high}
                </p>
                {r.prediction.previous !== null &&
                  r.prediction.previous !== r.prediction.latest && (
                    <p className="text-fg-2 tabular-nums">
                      Was about {r.prediction.previous}, now about {r.prediction.latest} (
                      {r.prediction.latest - r.prediction.previous >= 0 ? '+' : ''}
                      {r.prediction.latest - r.prediction.previous}).
                    </p>
                  )}
                {r.target.score && (
                  <p className="text-pretty text-fg-2">
                    Target for {r.target.course ?? 'their course'}
                    {r.target.university ? ` at ${r.target.university}` : ''}:{' '}
                    <span className="font-semibold tabular-nums">{r.target.score}+</span>
                  </p>
                )}
                <p className="text-sm text-muted">
                  This is an estimate from practice tests, not a guarantee.
                </p>
              </>
            ) : (
              <p className="text-fg-2">{child} hasn’t taken a diagnostic yet.</p>
            )}
          </Card>
          {history.length > 1 && (
            <Card>
              <CardTitle>Over time</CardTitle>
              <TrendChart history={history} target={r.target.score} />
            </Card>
          )}
          {r.biggestImprovement && (
            <Alert tone="success" title="Biggest improvement this week">
              {r.biggestImprovement}
            </Alert>
          )}
          <p className="text-pretty text-fg-2">
            {r.week.daysActive >= 4
              ? 'A quick “well done” goes a long way.'
              : 'A little encouragement to study daily this week will help.'}
          </p>
        </>
      )}
      <button
        type="button"
        className="min-h-11 text-sm text-muted underline"
        disabled={busy}
        onClick={() => void act('opt-out')}
      >
        Stop weekly reports
      </button>
    </div>
  );
}
