'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { STATUS_TONE } from '@/components/admin/status';
import { Table } from '@/components/admin/table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, SelectField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { dateTime, naira, shortDate } from '@/lib/format';
import { TEST_LABELS, type Me } from '@/lib/types';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Detail extends Me {
  devices: { id: string; label: string | null; lastActiveAt: string; revokedAt: string | null }[];
  orders: {
    id: string;
    amountKobo: number;
    status: string;
    paystackReference: string;
    createdAt: string;
    paidAt: string | null;
    product: { name: string };
    refunds: { amountKobo: number }[];
  }[];
  tests: {
    id: string;
    type: string;
    startedAt: string;
    submittedAt: string | null;
    _count: { items: number };
  }[];
  tickets: { id: string; category: string; status: string; body: string; createdAt: string }[];
  entitlements: {
    id: string;
    startsAt: string;
    endsAt: string;
    revokedAt: string | null;
    orderId: string | null;
    product: { name: string };
  }[];
  parentLinks: {
    id: string;
    parentPhone: string;
    optedInAt: string | null;
    optedOutAt: string | null;
  }[];
}
interface Guarantee {
  applicable: boolean;
  reason?: string;
  window?: { start: string; end: string; complete: boolean };
  baseline?: { mid: number } | null;
  latest?: { mid: number } | null;
  gain?: number | null;
  planCompletionPct?: number;
  miniMocks?: number;
  eligible?: boolean;
  refundDue?: boolean;
  orderId?: string;
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const u = useApi<Detail>(`/v1/admin/users/${id}`);
  const g = useApi<Guarantee>(`/v1/admin/users/${id}/guarantee`);
  const action = useAction();
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState<{ orderId: string; reason: string } | null>(null);

  if (u.loading && !u.data) return <PageSkeleton />;
  if (!u.data) return <Alert tone="danger">{u.error?.message ?? 'Not found'}</Alert>;
  const d = u.data;
  const reload = async () => {
    await u.reload();
    await g.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.name ?? d.phone}
        description={
          <>
            {d.phone} · {d.role} · UTME {d.examYear ?? '—'} ·{' '}
            {d.plan.paid ? `Season Pass until ${shortDate(d.plan.endsAt)}` : 'Free'}
          </>
        }
      />
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {action.notice && <Alert tone="success">{action.notice}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>Grant days (goodwill)</CardTitle>
          <form
            className="grid gap-3 sm:grid-cols-[6rem_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                'grant',
                async () => {
                  await api(`/v1/admin/users/${id}/grant-days`, {
                    method: 'POST',
                    body: { days: Number(days), reason },
                  });
                  await reload();
                },
                `Added ${days} days.`,
              );
            }}
          >
            <Field
              label="Days"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
            />
            <Field
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. late support reply"
              required
            />
            <Button
              type="submit"
              variant="secondary"
              loading={action.busy === 'grant'}
              disabled={!Number(days) || reason.length < 3}
            >
              Grant
            </Button>
          </form>
        </Card>

        <Card className="space-y-2">
          <CardTitle>Score-gain guarantee</CardTitle>
          {!g.data?.applicable ? (
            <p className="text-sm text-slate-600">{g.data?.reason ?? '…'}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-slate-600">Window</dt>
              <dd>
                {shortDate(g.data.window!.start)} – {shortDate(g.data.window!.end)}{' '}
                {g.data.window!.complete ? '(complete)' : '(running)'}
              </dd>
              <dt className="text-slate-600">Baseline → latest</dt>
              <dd className="tabular-nums">
                {g.data.baseline?.mid ?? '—'} → {g.data.latest?.mid ?? '—'} ({g.data.gain ?? '—'})
              </dd>
              <dt className="text-slate-600">Plan completion</dt>
              <dd className="tabular-nums">{g.data.planCompletionPct}% (need 80%)</dd>
              <dt className="text-slate-600">Mini-mocks</dt>
              <dd className="tabular-nums">{g.data.miniMocks} (need 4)</dd>
              <dt className="text-slate-600">Eligible</dt>
              <dd>{g.data.eligible ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>}</dd>
              <dt className="text-slate-600">Refund due</dt>
              <dd>
                {g.data.refundDue ? <Badge tone="danger">Yes — under 30 points</Badge> : 'No'}
              </dd>
            </dl>
          )}
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Orders</h2>
        <Table
          caption="Orders"
          rows={d.orders}
          rowKey={(o) => o.id}
          columns={[
            { header: 'Created', cell: (o) => dateTime(o.createdAt) },
            { header: 'Product', cell: (o) => o.product.name },
            {
              header: 'Amount',
              cell: (o) => <span className="tabular-nums">{naira(o.amountKobo)}</span>,
            },
            {
              header: 'Status',
              cell: (o) => <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>,
            },
            {
              header: 'Reference',
              cell: (o) => <span className="font-mono text-xs">{o.paystackReference}</span>,
            },
            {
              header: 'Actions',
              cell: (o) => (
                <div className="flex gap-2">
                  {o.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={action.busy === `rec${o.id}`}
                      onClick={() =>
                        void action.run(
                          `rec${o.id}`,
                          async () => {
                            const r = await api<{ result: string }>(
                              `/v1/admin/orders/${o.id}/reconcile`,
                              { method: 'POST' },
                            );
                            await reload();
                            return r;
                          },
                          'Re-checked with Paystack.',
                        )
                      }
                    >
                      Reconcile
                    </Button>
                  )}
                  {o.status === 'paid' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setRefund({ orderId: o.id, reason: 'goodwill' })}
                    >
                      Refund
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Devices</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {d.devices.map((dev) => (
              <li key={dev.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {dev.label ?? 'Unknown'} · {dateTime(dev.lastActiveAt)}{' '}
                  {dev.revokedAt && <Badge>signed out</Badge>}
                </span>
                {!dev.revokedAt && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={action.busy === dev.id}
                    onClick={() =>
                      void action.run(
                        dev.id,
                        async () => {
                          await api(`/v1/admin/users/${id}/devices/${dev.id}/revoke`, {
                            method: 'POST',
                          });
                          await reload();
                        },
                        'Device signed out.',
                      )
                    }
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Entitlements</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {d.entitlements.map((e) => (
              <li key={e.id} className="py-2">
                {e.product.name}: {shortDate(e.startsAt)} – {shortDate(e.endsAt)}{' '}
                {e.revokedAt && <Badge tone="danger">revoked</Badge>}{' '}
                {!e.orderId && <Badge>goodwill</Badge>}
              </li>
            ))}
            {!d.entitlements.length && <li className="py-2 text-slate-600">None</li>}
          </ul>
        </Card>
        <Card>
          <CardTitle>Recent tests</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {d.tests.map((t) => (
              <li key={t.id} className="py-2">
                {TEST_LABELS[t.type] ?? t.type} · {t._count.items} q · {dateTime(t.startedAt)}{' '}
                {t.submittedAt ? <Badge tone="success">submitted</Badge> : <Badge>open</Badge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Parent links</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {d.parentLinks.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {p.parentPhone}{' '}
                  {p.optedOutAt ? (
                    <Badge tone="danger">stopped</Badge>
                  ) : p.optedInAt ? (
                    <Badge tone="success">opted in</Badge>
                  ) : (
                    <Badge tone="warning">waiting</Badge>
                  )}
                </span>
                {!p.optedOutAt && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void action.run(
                        p.id,
                        async () => {
                          await api(`/v1/admin/parent-links/${p.id}/opt-out`, { method: 'POST' });
                          await reload();
                        },
                        'Parent opted out.',
                      )
                    }
                  >
                    Mark STOP
                  </Button>
                )}
              </li>
            ))}
            {!d.parentLinks.length && <li className="py-2 text-slate-600">None</li>}
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={!!refund}
        onOpenChange={(o) => !o && setRefund(null)}
        danger
        title="Refund this order in full?"
        description={
          <span className="block space-y-3">
            <span className="block">
              The money goes back through Paystack, the plan is revoked and any teacher commission
              is reversed.
            </span>
            <SelectField
              label="Reason"
              value={refund?.reason ?? 'goodwill'}
              onChange={(e) => setRefund((r) => r && { ...r, reason: e.target.value })}
            >
              <option value="guarantee">Score-gain guarantee</option>
              <option value="goodwill">Goodwill</option>
              <option value="duplicate">Duplicate payment</option>
              <option value="error">Error</option>
            </SelectField>
          </span>
        }
        confirmLabel="Refund"
        busy={action.busy === 'refund'}
        onConfirm={() =>
          void action.run(
            'refund',
            async () => {
              await api(`/v1/admin/orders/${refund!.orderId}/refund`, {
                method: 'POST',
                body: { reason: refund!.reason },
              });
              setRefund(null);
              await reload();
            },
            'Refunded.',
          )
        }
      />
    </div>
  );
}
