'use client';

import { Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Table } from '@/components/admin/table';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { shortDate } from '@/lib/format';
import type { OptionKey } from '@/lib/types';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface EventDetail {
  id: string;
  name: string | null;
  date: string;
  couponCode: string | null;
  school: { name: string };
  paper: {
    code: string;
    name: string;
    questions: {
      number: number;
      id: string;
      stem: string;
      options: Record<OptionKey, string>;
      correctOption: OptionKey;
      topic: string;
    }[];
  }[];
  entries: {
    id: string;
    studentName: string;
    className: string | null;
    result: {
      subjects: { code: string; correct: number; total: number }[];
      predicted: { low: number; high: number } | null;
    } | null;
  }[];
}
interface ClassReport {
  students: number;
  averagePredicted: number | null;
  distribution: { label: string; count: number }[];
  subjects: {
    code: string;
    name: string;
    students: number;
    averageScaled: number | null;
    weakestTopics: { name: string; accuracy: number }[];
  }[];
  recommendations: string[];
  note: string;
}

type Tab = 'entry' | 'paper' | 'key' | 'report';

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const ev = useApi<EventDetail>(`/v1/admin/school-events/${id}`);
  const [tab, setTab] = useState<Tab>('entry');
  const report = useApi<ClassReport>(
    tab === 'report' ? `/v1/admin/school-events/${id}/report` : null,
  );
  const action = useAction();
  const [student, setStudent] = useState({ studentName: '', className: '', parentPhone: '' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  if (ev.loading && !ev.data) return <PageSkeleton />;
  if (!ev.data) return <Alert tone="danger">{ev.error?.message ?? 'Not found'}</Alert>;
  const d = ev.data;

  const tabs: [Tab, string][] = [
    ['entry', `Enter answers (${d.entries.length})`],
    ['paper', 'Question paper'],
    ['key', 'Answer key'],
    ['report', 'Class report'],
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${d.school.name} — ${d.name || 'Mock day'}`}
        description={shortDate(d.date)}
        action={
          tab !== 'entry' && (
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" /> Print
            </Button>
          )
        }
      />
      <div role="tablist" className="flex flex-wrap gap-1 print:hidden">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'min-h-10 rounded-lg px-3 text-sm font-medium',
              tab === t ? 'bg-accent text-on-accent' : 'bg-surface ring-1 ring-line',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'entry' && (
        <div className="space-y-4">
          <Card>
            <CardTitle>Enter one answer sheet</CardTitle>
            <p className="text-sm text-muted">
              Type letters in question order, e.g. ABDCA… Use “-” for a blank. Press Enter to save
              and start the next sheet.
            </p>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(
                  'entry',
                  async () => {
                    const filled = Object.fromEntries(
                      Object.entries(answers).filter(([, v]) => v.trim()),
                    );
                    await api(`/v1/admin/school-events/${id}/entries`, {
                      method: 'POST',
                      body: {
                        ...student,
                        parentPhone: student.parentPhone || undefined,
                        answers: filled,
                      },
                    });
                    setStudent((s) => ({
                      studentName: '',
                      className: s.className,
                      parentPhone: '',
                    }));
                    setAnswers({});
                    await ev.reload();
                    nameRef.current?.focus();
                  },
                  'Saved.',
                );
              }}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1.5 text-sm font-medium">
                  Student name
                  <input
                    ref={nameRef}
                    className="block w-full rounded-lg border border-line-strong px-3 py-2.5 text-base"
                    value={student.studentName}
                    onChange={(e) => setStudent({ ...student, studentName: e.target.value })}
                    required
                  />
                </label>
                <Field
                  label="Class"
                  value={student.className}
                  onChange={(e) => setStudent({ ...student, className: e.target.value })}
                />
                <Field
                  label="Parent phone (only with consent)"
                  type="tel"
                  value={student.parentPhone}
                  onChange={(e) => setStudent({ ...student, parentPhone: e.target.value })}
                />
              </div>
              {d.paper.map((s) => {
                const v = answers[s.code] ?? '';
                return (
                  <Field
                    key={s.code}
                    label={`${s.name} (${s.questions.length} questions)`}
                    className="[&_input]:font-mono [&_input]:tracking-wider [&_input]:uppercase"
                    value={v}
                    maxLength={s.questions.length}
                    autoComplete="off"
                    spellCheck={false}
                    hint={`${v.length}/${s.questions.length} entered`}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        [s.code]: e.target.value.toUpperCase().replace(/[^ABCD-]/g, ''),
                      })
                    }
                  />
                );
              })}
              <Button
                type="submit"
                loading={action.busy === 'entry'}
                disabled={!student.studentName.trim()}
              >
                Save sheet
              </Button>
            </form>
            {action.error && (
              <Alert tone="danger" className="mt-3">
                {action.error}
              </Alert>
            )}
            {action.notice && (
              <Alert tone="success" className="mt-3">
                {action.notice}
              </Alert>
            )}
          </Card>
          <Table
            caption="Entered sheets"
            rows={d.entries}
            rowKey={(e) => e.id}
            empty="No sheets entered yet."
            columns={[
              {
                header: 'Student',
                cell: (e) => `${e.studentName}${e.className ? ` (${e.className})` : ''}`,
              },
              {
                header: 'Scores',
                cell: (e) => (
                  <span className="tabular-nums">
                    {e.result?.subjects.map((s) => `${s.code} ${s.correct}/${s.total}`).join(' · ')}
                  </span>
                ),
              },
              {
                header: 'Predicted',
                cell: (e) =>
                  e.result?.predicted ? (
                    <span className="tabular-nums">
                      {e.result.predicted.low}–{e.result.predicted.high}
                    </span>
                  ) : (
                    '—'
                  ),
              },
              {
                header: 'Report',
                cell: (e) => (
                  <Link className="text-accent underline" href={`/admin/schools/entries/${e.id}`}>
                    Print
                  </Link>
                ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'paper' && (
        <article className="space-y-8 rounded-xl bg-surface p-6 print:p-0">
          <header className="text-center">
            <h2 className="text-xl font-bold">{d.school.name}</h2>
            <p>
              {d.name || 'JAMB practice mock'} · {shortDate(d.date)}
            </p>
            <p className="text-sm">Name: ______________________ Class: ________</p>
          </header>
          {d.paper.map((s) => (
            <section key={s.code} className="break-before-page space-y-4 first:break-before-auto">
              <h3 className="text-lg font-bold">{s.name}</h3>
              <ol className="space-y-4">
                {s.questions.map((q) => (
                  <li key={q.id} className="break-inside-avoid">
                    <p>
                      <strong>{q.number}.</strong> {q.stem}
                    </p>
                    <p className="mt-1 grid grid-cols-2 gap-x-6 text-sm">
                      {(['A', 'B', 'C', 'D'] as OptionKey[]).map((l) => (
                        <span key={l}>
                          {l}. {q.options[l]}
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <p className="text-center text-xs">ScoreCoach is not affiliated with JAMB.</p>
        </article>
      )}

      {tab === 'key' && (
        <article className="space-y-6 rounded-xl bg-surface p-6">
          <Alert tone="warning" className="print:hidden">
            Keep the answer key separate from student papers.
          </Alert>
          {d.paper.map((s) => (
            <section key={s.code}>
              <h3 className="font-bold">{s.name}</h3>
              <p className="mt-1 font-mono text-sm break-all">
                {s.questions.map((q) => q.correctOption).join('')}
              </p>
              <ol className="mt-2 grid grid-cols-5 gap-1 text-sm sm:grid-cols-10">
                {s.questions.map((q) => (
                  <li key={q.id} className="tabular-nums">
                    {q.number}. {q.correctOption}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </article>
      )}

      {tab === 'report' && (
        <article className="space-y-6 rounded-xl bg-surface p-6">
          {!report.data ? (
            <PageSkeleton />
          ) : (
            <>
              <header>
                <h2 className="text-xl font-bold">Class readiness report</h2>
                <p className="text-muted">
                  {d.school.name} · {d.name || 'Mock day'} · {shortDate(d.date)} ·{' '}
                  {report.data.students} student{report.data.students === 1 ? '' : 's'}
                </p>
              </header>
              <section>
                <h3 className="font-semibold">Predicted UTME score distribution</h3>
                {report.data.averagePredicted && (
                  <p className="text-sm tabular-nums">
                    Class average: about {report.data.averagePredicted}
                  </p>
                )}
                <ul className="mt-2 space-y-1.5">
                  {report.data.distribution.map((b) => (
                    <li
                      key={b.label}
                      className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm"
                    >
                      <span>{b.label}</span>
                      <span aria-hidden="true" className="h-3 rounded-sm bg-surface-2">
                        <span
                          className="block h-3 rounded-sm bg-accent"
                          style={{
                            width: `${(b.count / Math.max(1, report.data!.students)) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="text-right tabular-nums">{b.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="grid gap-4 sm:grid-cols-2">
                {report.data.subjects.map((s) => (
                  <div key={s.code} className="rounded-lg border border-line p-3">
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-sm tabular-nums">Average {s.averageScaled ?? '—'}%</p>
                    <p className="mt-2 text-sm font-medium">Weakest topics</p>
                    <ul className="text-sm">
                      {s.weakestTopics.map((t) => (
                        <li key={t.name} className="tabular-nums">
                          {t.name} — {Math.round(t.accuracy * 100)}% correct
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
              <section>
                <h3 className="font-semibold">Recommendations</h3>
                <ul className="mt-1 list-disc pl-5 text-pretty">
                  {report.data.recommendations.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
              <p className="text-xs text-muted">{report.data.note}</p>
            </>
          )}
        </article>
      )}
    </div>
  );
}
