'use client';

import Link from 'next/link';
import { useState } from 'react';
import { STATUS_TONE } from '@/components/admin/status';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Ticket {
  id: string;
  category: string;
  body: string;
  status: string;
  phone: string | null;
  createdAt: string;
  firstResponseAt: string | null;
  slaBreached: boolean;
  slaDueAt: string;
  context: Record<string, unknown>;
  user: { id: string; phone: string; name: string | null } | null;
}
interface Stats {
  tickets: number;
  medianFirstResponseMinutes: number | null;
  withinSlaPct: number | null;
  byCategory: Record<string, number>;
}

/** Spec §18: payment first, then access, then content. 12-hour first reply. */
export default function TicketsPage() {
  const [view, setView] = useState<'active' | 'resolved'>('active');
  const list = useApi<Ticket[]>(
    `/v1/admin/tickets${view === 'resolved' ? '?status=resolved' : ''}`,
  );
  const stats = useApi<Stats>('/v1/admin/tickets/stats');
  const action = useAction();
  const update = (t: Ticket, status: 'pending' | 'resolved') =>
    void action.run(t.id + status, async () => {
      await api(`/v1/admin/tickets/${t.id}`, { method: 'PATCH', body: { status } });
      await list.reload();
      await stats.reload();
    });

  return (
    <div className="space-y-4">
      <PageHeader title="Support" />
      {stats.data && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <p className="text-sm text-muted">Tickets (30 days)</p>
            <p className="text-2xl font-bold tabular-nums">{stats.data.tickets}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Median first reply</p>
            <p className="text-2xl font-bold tabular-nums">
              {stats.data.medianFirstResponseMinutes ?? '—'} min
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Within 12 h</p>
            <p className="text-2xl font-bold tabular-nums">{stats.data.withinSlaPct ?? '—'}%</p>
          </Card>
        </div>
      )}
      <div className="flex gap-2">
        {(['active', 'resolved'] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? 'primary' : 'secondary'}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {v === 'active' ? 'Open' : 'Resolved'}
          </Button>
        ))}
      </div>
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      <ul className="space-y-3">
        {list.data?.map((t) => (
          <li key={t.id}>
            <Card className={t.slaBreached ? 'border-red-500/40' : ''}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  tone={t.category === 'payment' || t.category === 'refund' ? 'danger' : 'neutral'}
                >
                  {t.category}
                </Badge>
                <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                {t.slaBreached && <Badge tone="danger">SLA missed — owe 30 days</Badge>}
                <span className="text-muted">{dateTime(t.createdAt)}</span>
                {t.user ? (
                  <Link className="text-accent underline" href={`/admin/users/${t.user.id}`}>
                    {t.user.name ?? t.user.phone}
                  </Link>
                ) : (
                  <span>{t.phone ?? 'anonymous'}</span>
                )}
              </div>
              <p className="mt-2 text-pretty whitespace-pre-line">{t.body}</p>
              <details className="mt-2 text-xs text-muted">
                <summary className="cursor-pointer">Context</summary>
                <pre className="mt-1 overflow-x-auto">{JSON.stringify(t.context, null, 2)}</pre>
              </details>
              {t.status !== 'resolved' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(t.phone ?? t.user?.phone) && (
                    <a
                      className="inline-flex min-h-9 items-center rounded-lg border border-line-strong px-3 text-sm font-semibold"
                      href={`https://wa.me/${(t.phone ?? t.user!.phone).replace('+', '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp them
                    </a>
                  )}
                  {t.status === 'open' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={action.busy === `${t.id}pending`}
                      onClick={() => update(t, 'pending')}
                    >
                      Mark replied
                    </Button>
                  )}
                  <Button
                    size="sm"
                    loading={action.busy === `${t.id}resolved`}
                    onClick={() => update(t, 'resolved')}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
        {list.data?.length === 0 && <p className="text-muted">No tickets.</p>}
      </ul>
    </div>
  );
}
