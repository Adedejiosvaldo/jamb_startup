'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { naira } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface Metrics {
  funnel30d: Record<string, number>;
  revenue30d: { kobo: number; orders: number };
  refunds30d: { kobo: number; count: number };
  weeklyActiveStudents: number;
  activePaidStudents: number;
  openQuestionReports: number;
  openTickets: number;
}

const FUNNEL: [string, string][] = [
  ['landing_viewed', 'Landing views'],
  ['checker_used', 'Checker used'],
  ['diagnostic_started', 'Diagnostics started'],
  ['mock_completed', 'Tests completed'],
  ['paywall_viewed', 'Paywall views'],
  ['checkout_started', 'Checkouts started'],
  ['payment_succeeded', 'Payments'],
];

/** Sunday review numbers (spec §27). */
export default function AdminDashboard() {
  const { data, loading } = useApi<Metrics>('/v1/admin/metrics');
  if (loading || !data) return <PageSkeleton />;
  const max = Math.max(1, ...FUNNEL.map(([k]) => data.funnel30d[k] ?? 0));
  const stats = [
    {
      label: 'Revenue (30 days)',
      value: naira(data.revenue30d.kobo),
      sub: `${data.revenue30d.orders} orders`,
    },
    {
      label: 'Refunds (30 days)',
      value: naira(data.refunds30d.kobo),
      sub: `${data.refunds30d.count} refunds`,
    },
    { label: 'Active paid students', value: data.activePaidStudents },
    { label: 'Weekly active students', value: data.weeklyActiveStudents },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
            {s.sub && <p className="text-sm text-muted">{s.sub}</p>}
          </Card>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/tickets"
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Card className={data.openTickets ? 'border-amber-500/40' : ''}>
            <p className="text-sm text-muted">Open support tickets</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.openTickets}</p>
          </Card>
        </Link>
        <Link
          href="/admin/reports"
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Card className={data.openQuestionReports ? 'border-amber-500/40' : ''}>
            <p className="text-sm text-muted">Open question reports</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.openQuestionReports}</p>
          </Card>
        </Link>
      </div>
      <Card>
        <h2 className="font-semibold">Funnel, last 30 days</h2>
        <ul className="mt-4 space-y-2">
          {FUNNEL.map(([k, label]) => {
            const v = data.funnel30d[k] ?? 0;
            return (
              <li key={k} className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3 text-sm">
                <span>{label}</span>
                <span aria-hidden="true" className="h-3 rounded-sm bg-surface-2">
                  <span
                    className="block h-3 rounded-sm bg-accent"
                    style={{ width: `${(v / max) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{v}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
