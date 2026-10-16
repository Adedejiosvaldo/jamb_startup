'use client';

import { Copy, Users } from 'lucide-react';
import { useState } from 'react';
import { SimpleShell } from '@/components/simple-shell';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Field, TextareaField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { minutesLabel, naira, shortDate } from '@/lib/format';
import { useRequireAuth } from '@/lib/session';
import { useApi } from '@/lib/use-api';

interface TeacherMe {
  status: 'none' | 'pending' | 'verified';
  referralCode?: string;
  commissionPct?: number;
  coupon?: { code: string; percentOff: number | null } | null;
}
interface ClassRow {
  id: string;
  name: string;
  joinCode: string;
  _count: { members: number };
}
interface Overview {
  class: { id: string; name: string; joinCode: string };
  students: {
    id: string;
    name: string;
    daysActive: number;
    minutes: number;
    predicted: number | null;
    inactive: boolean;
  }[];
  inactive: string[];
  weakestTopics: { subjectCode: string; name: string; mastery: number; students: number }[];
  distribution: { label: string; count: number }[];
}
interface Earnings {
  paidStudents: number;
  owedKobo: number;
  paidKobo: number;
  history: { id: string; amountKobo: number; status: string; saleAt: string | null }[];
}

export default function TeacherPage() {
  const session = useRequireAuth({ onboarding: false });
  const me = useApi<TeacherMe>(session.signedIn ? '/v1/teacher/me' : null);
  const verified = me.data?.status === 'verified';
  const classes = useApi<ClassRow[]>(verified ? '/v1/teacher/classes' : null);
  const earnings = useApi<Earnings>(verified ? '/v1/teacher/earnings' : null);
  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? classes.data?.[0]?.id ?? null;
  const overview = useApi<Overview>(activeId ? `/v1/teacher/classes/${activeId}/overview` : null);

  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [newClass, setNewClass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const copy = (text: string) =>
    void navigator.clipboard?.writeText(text).then(() => setCopied(text));

  let body;
  if (me.loading || session.loading) body = <PageSkeleton />;
  else if (me.data?.status === 'none' || !me.data) {
    body = (
      <form
        className="max-w-md space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            await api('/v1/teacher/apply', { method: 'POST', body: { name, about } });
            await me.reload();
          });
        }}
      >
        <PageHeader
          title="Apply as a lesson teacher"
          description="We’ll call you to verify, usually within 2 working days."
        />
        <Field
          label="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextareaField
          label="About your lesson"
          hint="Where you teach, how many students, which subjects."
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
        <Button type="submit" block loading={busy} disabled={name.trim().length < 2}>
          Apply
        </Button>
      </form>
    );
  } else if (me.data.status === 'pending') {
    body = (
      <Alert tone="info" title="Application received">
        We’ll call you to verify your lesson. After that your dashboard and code (
        {me.data.referralCode}) go live.
      </Alert>
    );
  } else {
    const o = overview.data;
    body = (
      <div className="space-y-6">
        <PageHeader title="Your classes" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-muted">Your student discount code</p>
            <p className="mt-1 font-mono text-xl font-bold">
              {me.data.coupon?.code ?? me.data.referralCode}
            </p>
            {me.data.coupon?.percentOff && (
              <p className="text-sm text-muted">
                {me.data.coupon.percentOff}% off for your students
              </p>
            )}
          </Card>
          <Card>
            <p className="text-sm text-muted">Commission owed</p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {naira(earnings.data?.owedKobo ?? 0)}
            </p>
            <p className="text-sm text-muted">{me.data.commissionPct}% per sale · paid monthly</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Paid students</p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {earnings.data?.paidStudents ?? 0}
            </p>
            <p className="text-sm text-muted">
              {naira(earnings.data?.paidKobo ?? 0)} paid out so far
            </p>
          </Card>
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              const c = await api<ClassRow>('/v1/teacher/classes', {
                method: 'POST',
                body: { name: newClass },
              });
              setNewClass('');
              await classes.reload();
              setSelected(c.id);
            });
          }}
        >
          <Field
            label="New class name"
            className="flex-1"
            placeholder="e.g. Saturday JAMB class"
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={newClass.trim().length < 2 || busy}>
            Create
          </Button>
        </form>

        {classes.data?.length ? (
          <>
            <div role="tablist" aria-label="Classes" className="flex gap-1 overflow-x-auto">
              {classes.data.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  type="button"
                  aria-selected={activeId === c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    'min-h-11 rounded-lg px-3 text-sm font-medium whitespace-nowrap',
                    activeId === c.id ? 'bg-accent text-on-accent' : 'bg-surface ring-1 ring-line',
                  )}
                >
                  {c.name} <span className="tabular-nums">({c._count.members})</span>
                </button>
              ))}
            </div>
            {overview.loading && <PageSkeleton />}
            {o && (
              <div role="tabpanel" className="space-y-4">
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">
                      Class code — students enter it in Account → Lesson class
                    </p>
                    <p className="font-mono text-2xl font-bold">{o.class.joinCode}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      copy(`${window.location.origin}/start?class=${o.class.joinCode}`)
                    }
                  >
                    <Copy aria-hidden="true" className="size-4" />{' '}
                    {copied?.includes(o.class.joinCode) ? 'Copied' : 'Copy join link'}
                  </Button>
                </Card>
                {o.students.length === 0 ? (
                  <Empty
                    title="No students yet"
                    action={
                      <Button
                        onClick={() =>
                          copy(`${window.location.origin}/start?class=${o.class.joinCode}`)
                        }
                      >
                        Copy join link
                      </Button>
                    }
                  >
                    Share the join link in your class WhatsApp group.
                  </Empty>
                ) : (
                  <>
                    {o.inactive.length > 0 && (
                      <Alert tone="warning" title={`${o.inactive.length} inactive for 3+ days`}>
                        {o.inactive.join(', ')}
                      </Alert>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card>
                        <CardTitle>Weakest topics in this class</CardTitle>
                        <ol className="mt-2 space-y-1.5 text-sm">
                          {o.weakestTopics.map((t) => (
                            <li key={t.name} className="flex justify-between gap-3">
                              <span className="text-pretty">
                                {t.subjectCode} · {t.name}
                              </span>
                              <span className="tabular-nums">{Math.round(t.mastery * 100)}%</span>
                            </li>
                          ))}
                          {!o.weakestTopics.length && (
                            <li className="text-muted">Not enough practice data yet.</li>
                          )}
                        </ol>
                      </Card>
                      <Card>
                        <CardTitle>Predicted scores</CardTitle>
                        <ul className="mt-2 space-y-1.5 text-sm">
                          {o.distribution.map((d) => (
                            <li key={d.label} className="flex justify-between">
                              <span>{d.label}</span>
                              <span className="font-semibold tabular-nums">{d.count}</span>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    </div>
                    <Card className="overflow-x-auto p-0">
                      <table className="w-full text-sm">
                        <caption className="sr-only">Students</caption>
                        <thead className="bg-canvas text-left text-muted">
                          <tr>
                            <th className="p-3 font-medium">Student</th>
                            <th className="p-3 font-medium">Days (7)</th>
                            <th className="p-3 font-medium">Time</th>
                            <th className="p-3 font-medium">Predicted</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {o.students.map((s) => (
                            <tr key={s.id}>
                              <td className="p-3">
                                {s.name} {s.inactive && <Badge tone="warning">Inactive</Badge>}
                              </td>
                              <td className="p-3 tabular-nums">{s.daysActive}</td>
                              <td className="p-3 tabular-nums">{minutesLabel(s.minutes)}</td>
                              <td className="p-3 tabular-nums">{s.predicted ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <Empty
            title="Create your first class"
            action={
              <span className="flex items-center gap-1 text-sm text-muted">
                <Users aria-hidden="true" className="size-4" /> Use the form above
              </span>
            }
          >
            Then share the class code with your students.
          </Empty>
        )}

        {earnings.data && earnings.data.history.length > 0 && (
          <Card>
            <CardTitle>Earnings history</CardTitle>
            <ul className="mt-2 divide-y divide-line text-sm">
              {earnings.data.history.map((h) => (
                <li key={h.id} className="flex justify-between py-2">
                  <span>{h.saleAt ? shortDate(h.saleAt) : '—'}</span>
                  <span className="tabular-nums">
                    {naira(h.amountKobo)} ·{' '}
                    <Badge
                      tone={
                        h.status === 'paid'
                          ? 'success'
                          : h.status === 'reversed'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {h.status}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  return (
    <SimpleShell home="/teacher">
      {body}
      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}
    </SimpleShell>
  );
}
