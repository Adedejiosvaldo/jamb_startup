'use client';

import Link from 'next/link';
import { useState } from 'react';
import { STATUS_TONE } from '@/components/admin/status';
import { Table } from '@/components/admin/table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, SelectField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Subject } from '@/lib/types';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Row {
  id: string;
  stem: string;
  status: string;
  version: number;
  difficulty: number;
  updatedAt: string;
  subject: { code: string };
  topic: { name: string };
  _count: { reports: number };
}

export default function QuestionsPage() {
  const { me } = useSession();
  const subjects = useApi<Subject[]>('/v1/subjects', { auth: false });
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const params = new URLSearchParams({
    page: String(page),
    pageSize: '25',
    ...(subject && { subject }),
    ...(status && { status }),
    ...(search && { q: search }),
  });
  const list = useApi<{ items: Row[]; total: number; pages: number }>(
    `/v1/admin/questions?${params}`,
  );
  const action = useAction();
  const isAdmin = me?.role === 'admin';

  const reviewed = list.data?.items.filter((r) => r.status === 'reviewed') ?? [];
  const drafts =
    list.data?.items.filter((r) => r.status === 'draft' || r.status === 'flagged') ?? [];
  const selectable = (status: string) =>
    status === 'draft' || status === 'flagged' || (status === 'reviewed' && isAdmin);
  const selectedDrafts = drafts.filter((r) => selected.has(r.id)).map((r) => r.id);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Questions"
        description={list.data ? `${list.data.total} questions` : undefined}
        action={
          <div className="flex gap-2">
            <ButtonLink href="/admin/questions/import" variant="secondary" size="sm">
              Bulk import
            </ButtonLink>
            <ButtonLink href="/admin/questions/new" size="sm">
              New question
            </ButtonLink>
          </div>
        }
      />
      <form
        className="grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
          setPage(1);
        }}
      >
        <SelectField
          label="Subject"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          {subjects.data?.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          {['draft', 'reviewed', 'live', 'flagged', 'retired'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <Field
          label="Search question text"
          className="sm:col-span-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
        />
      </form>

      {(drafts.length > 0 || (isAdmin && reviewed.length > 0)) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/[0.03] p-3 text-sm">
          <span className="text-muted">
            {selected.size
              ? `${selected.size} selected`
              : 'Tick questions to review or publish them in bulk.'}
          </span>
          {drafts.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedDrafts.length}
              loading={action.busy === 'approve'}
              onClick={() =>
                void action.run(
                  'approve',
                  async () => {
                    const res = await api<{ done: number; failed: { error: string }[] }>(
                      '/v1/admin/questions/review-bulk',
                      {
                        method: 'POST',
                        body: { ids: selectedDrafts, decision: 'approve' },
                      },
                    );
                    setSelected(new Set());
                    await list.reload();
                    if (res.failed.length)
                      throw new Error(
                        `${res.done} approved. ${res.failed.length} not: ${res.failed[0]!.error}`,
                      );
                    return res;
                  },
                  'Approved. An admin can now publish them.',
                )
              }
            >
              Approve {selectedDrafts.length || ''} draft{selectedDrafts.length === 1 ? '' : 's'}
            </Button>
          )}
          {isAdmin && reviewed.length > 0 && (
            <Button
              size="sm"
              loading={action.busy === 'publish'}
              onClick={() =>
                void action.run(
                  'publish',
                  async () => {
                    const picked = reviewed.filter((r) => selected.has(r.id)).map((r) => r.id);
                    const ids = picked.length ? picked : reviewed.map((r) => r.id);
                    await api('/v1/admin/questions/publish', { method: 'POST', body: { ids } });
                    setSelected(new Set());
                    await list.reload();
                  },
                  'Published.',
                )
              }
            >
              Publish{' '}
              {reviewed.some((r) => selected.has(r.id))
                ? 'selected'
                : `all ${reviewed.length} reviewed`}
            </Button>
          )}
          {list.data && (
            <button
              type="button"
              className="ml-auto text-sm text-accent underline-offset-4 hover:underline"
              onClick={() =>
                setSelected(
                  new Set(list.data!.items.filter((r) => selectable(r.status)).map((r) => r.id)),
                )
              }
            >
              Select all on page
            </button>
          )}
        </div>
      )}
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {action.notice && <Alert tone="success">{action.notice}</Alert>}

      <Table
        caption="Questions"
        rows={list.data?.items ?? []}
        rowKey={(r) => r.id}
        empty={list.loading ? 'Loading…' : 'No questions match.'}
        columns={[
          {
            header: <span className="sr-only">Select</span>,
            cell: (r) =>
              selectable(r.status) ? (
                <input
                  type="checkbox"
                  aria-label="Select"
                  className="size-4 accent-emerald-400"
                  checked={selected.has(r.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (n.has(r.id)) n.delete(r.id);
                      else n.add(r.id);
                      return n;
                    })
                  }
                />
              ) : null,
          },
          {
            header: 'Question',
            cell: (r) => (
              <Link
                href={`/admin/questions/${r.id}`}
                className="line-clamp-2 font-medium text-fg underline-offset-4 hover:text-accent hover:underline"
              >
                {r.stem}
              </Link>
            ),
          },
          {
            header: 'Topic',
            cell: (r) => (
              <span className="whitespace-nowrap">
                {r.subject.code} · {r.topic.name}
              </span>
            ),
          },
          {
            header: 'Status',
            cell: (r) => (
              <span className="flex flex-wrap gap-1">
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                {r._count.reports > 0 && <Badge tone="danger">{r._count.reports} reports</Badge>}
              </span>
            ),
          },
          { header: 'v', cell: (r) => <span className="tabular-nums">{r.version}</span> },
          {
            header: 'Updated',
            cell: (r) => <span className="whitespace-nowrap">{shortDate(r.updatedAt)}</span>,
          },
        ]}
      />
      {list.data && list.data.pages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm tabular-nums">
            Page {page} of {list.data.pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= list.data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
