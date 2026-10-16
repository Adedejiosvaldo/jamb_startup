'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { QuestionForm, type QuestionInput } from '@/components/admin/question-form';
import { STATUS_TONE } from '@/components/admin/status';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { OptionKey } from '@/lib/types';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Detail extends QuestionInput {
  id: string;
  status: string;
  version: number;
  authorId: string | null;
  reviewedAt: string | null;
  subject: { code: string; name: string };
  topic: { name: string };
  reports: { id: string; reason: string; note: string | null; status: string; createdAt: string }[];
  history: { id: string; action: string; ts: string; actorId: string | null }[];
}

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const { me } = useSession();
  const q = useApi<Detail>(`/v1/admin/questions/${id}`);
  const action = useAction();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [confirmRetire, setConfirmRetire] = useState(false);

  if (q.loading && !q.data) return <PageSkeleton />;
  if (!q.data) return <Alert tone="danger">{q.error?.message ?? 'Not found'}</Alert>;
  const d = q.data;
  const isAdmin = me?.role === 'admin';
  const ownQuestion = d.authorId === me?.id;

  const act = (key: string, fn: () => Promise<unknown>, msg: string) =>
    void action.run(
      key,
      async () => {
        await fn();
        await q.reload();
      },
      msg,
    );

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={`${d.subject.code} · ${d.topic.name}`}
        description={
          <span className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge> version {d.version}
            {d.reviewedAt && ` · reviewed ${dateTime(d.reviewedAt)}`}
          </span>
        }
        action={
          !editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )
        }
      />
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {action.notice && <Alert tone="success">{action.notice}</Alert>}

      {editing ? (
        <Card>
          <Alert tone="warning" className="mb-4">
            Saving an edit creates a new version and sends the question back to draft. It stays
            hidden from students until re-reviewed and published.
          </Alert>
          <QuestionForm
            initial={d}
            initialSubject={d.subject.code}
            submitLabel="Save new version"
            busy={action.busy === 'save'}
            onSubmit={(input) =>
              void action.run(
                'save',
                async () => {
                  await api(`/v1/admin/questions/${id}`, { method: 'PATCH', body: input });
                  setEditing(false);
                  await q.reload();
                },
                'Saved as a new draft version.',
              )
            }
          />
        </Card>
      ) : (
        <Card className="space-y-4">
          <p className="text-pretty whitespace-pre-line">{d.stem}</p>
          <ul className="space-y-1.5">
            {(['A', 'B', 'C', 'D'] as OptionKey[]).map((l) => (
              <li
                key={l}
                className={
                  l === d.correctOption
                    ? 'rounded-md bg-green-50 px-2 py-1 font-medium text-green-900'
                    : 'px-2 py-1'
                }
              >
                <span className="font-semibold">{l}.</span> {d.options[l]}
                {d.explanationsWrong?.[l] && (
                  <p className="text-sm font-normal text-slate-600">
                    Why wrong: {d.explanationsWrong[l]}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <strong>Explanation:</strong>{' '}
            {d.explanationCorrect ?? <em className="text-red-700">missing</em>}
          </div>
          <p className="text-sm text-slate-600">
            Difficulty {['', 'easy', 'medium', 'hard'][d.difficulty]} · {d.source}
            {d.pastYear ? ` (${d.pastYear})` : ''}
          </p>
        </Card>
      )}

      {!editing && (d.status === 'draft' || d.status === 'flagged') && (
        <Card className="space-y-3">
          <CardTitle>Review</CardTitle>
          {ownQuestion && (
            <p className="text-sm text-slate-600">
              You wrote this question, so another reviewer must approve it.
            </p>
          )}
          <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button
              disabled={ownQuestion}
              loading={action.busy === 'approve'}
              onClick={() =>
                act(
                  'approve',
                  () =>
                    api(`/v1/admin/questions/${id}/review`, {
                      method: 'POST',
                      body: { decision: 'approve', note },
                    }),
                  'Approved.',
                )
              }
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              loading={action.busy === 'reject'}
              onClick={() =>
                act(
                  'reject',
                  () =>
                    api(`/v1/admin/questions/${id}/review`, {
                      method: 'POST',
                      body: { decision: 'reject', note },
                    }),
                  'Sent back to draft.',
                )
              }
            >
              Request changes
            </Button>
          </div>
        </Card>
      )}

      {!editing && isAdmin && (
        <div className="flex flex-wrap gap-2">
          {d.status === 'reviewed' && (
            <Button
              loading={action.busy === 'publish'}
              onClick={() =>
                act(
                  'publish',
                  () => api('/v1/admin/questions/publish', { method: 'POST', body: { ids: [id] } }),
                  'Live for students.',
                )
              }
            >
              Publish
            </Button>
          )}
          {d.status !== 'retired' && (
            <Button variant="danger" onClick={() => setConfirmRetire(true)}>
              Retire
            </Button>
          )}
        </div>
      )}

      {d.reports.length > 0 && (
        <Card>
          <CardTitle>Student reports</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {d.reports.map((r) => (
              <li key={r.id} className="py-2">
                <Badge tone={r.status === 'open' ? 'warning' : 'neutral'}>{r.status}</Badge>{' '}
                {r.reason.replace('_', ' ')} · {dateTime(r.createdAt)}
                {r.note && <p className="mt-1 text-slate-700">{r.note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle>History</CardTitle>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {d.history.map((h) => (
            <li key={h.id}>
              {dateTime(h.ts)} · {h.action.replace('_', ' ')}
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={confirmRetire}
        onOpenChange={setConfirmRetire}
        danger
        title="Retire this question?"
        description="Students will no longer see it. It stays in the history."
        confirmLabel="Retire"
        onConfirm={() => {
          setConfirmRetire(false);
          act(
            'retire',
            () => api(`/v1/admin/questions/${id}/retire`, { method: 'POST' }),
            'Retired.',
          );
        }}
      />
    </div>
  );
}
