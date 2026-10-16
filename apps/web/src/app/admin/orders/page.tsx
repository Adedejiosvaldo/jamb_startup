'use client';

import Link from 'next/link';
import { useState } from 'react';
import { STATUS_TONE } from '@/components/admin/status';
import { Table } from '@/components/admin/table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { dateTime, naira } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Order {
  id: string;
  amountKobo: number;
  status: string;
  payerPhone: string;
  paystackReference: string;
  payLinkToken: string | null;
  createdAt: string;
  product: { name: string };
  user: { id: string; phone: string; name: string | null } | null;
  coupon: { code: string } | null;
}

/** Paid-but-not-unlocked runbook (spec §18): find the order, Reconcile. */
export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const list = useApi<{ items: Order[]; total: number }>(
    `/v1/admin/orders?pageSize=50${status ? `&status=${status}` : ''}${search ? `&phone=${encodeURIComponent(search)}` : ''}`,
  );
  const action = useAction();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description={list.data ? `${list.data.total} orders` : undefined}
      />
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(phone.replace(/^0/, ''));
        }}
      >
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {['pending', 'paid', 'failed', 'refunded'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <Field
          label="Phone (student or payer)"
          className="sm:col-span-2"
          type="search"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </form>
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {action.notice && <Alert tone="success">{action.notice}</Alert>}
      <Table
        caption="Orders"
        rows={list.data?.items ?? []}
        rowKey={(o) => o.id}
        empty={list.loading ? 'Loading…' : 'No orders.'}
        columns={[
          {
            header: 'Created',
            cell: (o) => <span className="whitespace-nowrap">{dateTime(o.createdAt)}</span>,
          },
          {
            header: 'Student',
            cell: (o) =>
              o.user ? (
                <Link
                  className="text-teal-800 underline-offset-4 hover:underline"
                  href={`/admin/users/${o.user.id}`}
                >
                  {o.user.name ?? o.user.phone}
                </Link>
              ) : (
                '—'
              ),
          },
          {
            header: 'Payer',
            cell: (o) => (
              <span className="whitespace-nowrap">
                {o.payerPhone}
                {o.payLinkToken && ' (parent link)'}
              </span>
            ),
          },
          {
            header: 'Amount',
            cell: (o) => (
              <span className="tabular-nums">
                {naira(o.amountKobo)}
                {o.coupon && ` · ${o.coupon.code}`}
              </span>
            ),
          },
          { header: 'Status', cell: (o) => <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge> },
          {
            header: 'Action',
            cell: (o) =>
              o.status === 'pending' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={action.busy === o.id}
                  onClick={() =>
                    void action.run(
                      o.id,
                      async () => {
                        const r = await api<{ result: string }>(
                          `/v1/admin/orders/${o.id}/reconcile`,
                          { method: 'POST' },
                        );
                        await list.reload();
                        return r;
                      },
                      'Re-checked with Paystack.',
                    )
                  }
                >
                  Reconcile
                </Button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
