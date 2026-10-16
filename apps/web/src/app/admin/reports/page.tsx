'use client';

import Link from 'next/link';
import { Table } from '@/components/admin/table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Report {
  id: string;
  reason: string;
  note: string | null;
  createdAt: string;
  question: { id: string; stem: string; status: string; subject: { code: string } };
  user: { phone: string; name: string | null } | null;
}

/** F-SUP-03 queue. Confirmed reports pull the question and reward the reporter with 7 days. */
export default function ReportsPage() {
  const { me } = useSession();
  const list = useApi<Report[]>('/v1/admin/question-reports');
  const action = useAction();
  const resolve = (id: string, decision: 'confirmed' | 'rejected') =>
    void action.run(`${id}${decision}`, async () => {
      await api(`/v1/admin/question-reports/${id}/resolve`, {
        method: 'POST',
        body: { decision, rewardDays: decision === 'confirmed' ? 7 : 0 },
      });
      await list.reload();
    });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Question reports"
        description="Target: fix confirmed errors within 48 hours."
      />
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      <Table
        caption="Open question reports"
        rows={list.data ?? []}
        rowKey={(r) => r.id}
        empty={list.loading ? 'Loading…' : 'No open reports.'}
        columns={[
          {
            header: 'Reported',
            cell: (r) => <span className="whitespace-nowrap">{dateTime(r.createdAt)}</span>,
          },
          {
            header: 'Question',
            cell: (r) => (
              <Link
                href={`/admin/questions/${r.question.id}`}
                className="line-clamp-2 text-teal-800 underline-offset-4 hover:underline"
              >
                {r.question.subject.code}: {r.question.stem}
              </Link>
            ),
          },
          {
            header: 'Reason',
            cell: (r) => (
              <div>
                <Badge tone="warning">{r.reason.replace('_', ' ')}</Badge>
                {r.note && <p className="mt-1 text-slate-700">{r.note}</p>}
              </div>
            ),
          },
          { header: 'By', cell: (r) => r.user?.name ?? r.user?.phone ?? '—' },
          {
            header: 'Decision',
            cell: (r) =>
              me?.role === 'admin' ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={action.busy === `${r.id}confirmed`}
                    onClick={() => resolve(r.id, 'confirmed')}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={action.busy === `${r.id}rejected`}
                    onClick={() => resolve(r.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <span className="text-slate-600">Admin decides</span>
              ),
          },
        ]}
      />
    </div>
  );
}
