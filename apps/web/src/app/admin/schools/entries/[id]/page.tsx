'use client';

import { Printer } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { shortDate } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface EntryReport {
  studentName: string;
  className: string | null;
  school: string;
  date: string;
  result: {
    subjects: { code: string; correct: number; total: number; scaled: number }[];
    predicted: { low: number; mid: number; high: number; status: string } | null;
    weakTopics: { subjectCode: string; name: string; accuracy: number }[];
  };
  offerUrl: string;
  couponCode: string | null;
}

/** F-SCH-03 individual report — print or save as PDF and share through the school. */
export default function EntryReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApi<EntryReport>(`/v1/admin/school-entries/${id}/report`);
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  if (!data) return <PageSkeleton />;
  const r = data.result;
  return (
    <div className="space-y-4">
      <Button variant="secondary" size="sm" className="print:hidden" onClick={() => window.print()}>
        <Printer aria-hidden="true" className="size-4" /> Print / save as PDF
      </Button>
      <article className="mx-auto max-w-2xl space-y-5 rounded-xl bg-surface p-6">
        <header>
          <p className="text-sm font-semibold text-accent">ScoreCoach mock report</p>
          <h1 className="text-2xl font-bold">{data.studentName}</h1>
          <p className="text-muted">
            {data.className ? `${data.className} · ` : ''}
            {data.school} · {shortDate(data.date)}
          </p>
        </header>
        {r.predicted && (
          <section>
            <h2 className="font-semibold">Estimated UTME score</h2>
            <p className="text-3xl font-bold tabular-nums">
              {r.predicted.low}–{r.predicted.high}
            </p>
            <p className="text-sm text-muted">
              From one short paper mock, so the range is wide. Practice narrows it.
            </p>
          </section>
        )}
        <section>
          <h2 className="font-semibold">Scores</h2>
          <table className="mt-2 w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.subjects.map((s) => (
                <tr key={s.code}>
                  <th scope="row" className="py-1.5 text-left font-medium">
                    {s.code}
                  </th>
                  <td className="py-1.5 text-right tabular-nums">
                    {s.correct}/{s.total} ({s.scaled}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {r.weakTopics.length > 0 && (
          <section>
            <h2 className="font-semibold">Topics to work on first</h2>
            <ol className="mt-1 list-decimal pl-5">
              {r.weakTopics.map((t) => (
                <li key={t.name}>
                  {t.subjectCode}: {t.name}
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="rounded-lg bg-accent-soft p-4">
          <h2 className="font-semibold">Keep going for free</h2>
          <p className="text-sm text-pretty">
            Take the free diagnostic and get a daily plan at{' '}
            <strong>{data.offerUrl.replace(/^https?:\/\//, '')}</strong>
            {data.couponCode && (
              <>
                {' '}
                — use code <strong>{data.couponCode}</strong> for a discount
              </>
            )}
            .
          </p>
        </section>
        <p className="text-xs text-muted">
          Estimates, not guarantees. ScoreCoach is not affiliated with JAMB.
        </p>
      </article>
    </div>
  );
}
