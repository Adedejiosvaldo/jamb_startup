'use client';

import { useState } from 'react';
import { Table } from '@/components/admin/table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { naira, shortDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Coupon {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffKobo: number | null;
  maxUses: number | null;
  used: number;
  expiresAt: string | null;
  ownerTeacher: { user: { name: string | null } } | null;
}

export default function CouponsPage() {
  const list = useApi<Coupon[]>('/v1/admin/coupons');
  const action = useAction();
  const [f, setF] = useState({
    code: '',
    percentOff: '',
    amountOffNaira: '',
    maxUses: '',
    expiresAt: '',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Early-bird, school and teacher codes. One coupon per order."
      />
      <Card>
        <CardTitle>New coupon</CardTitle>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-5 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(
              'create',
              async () => {
                await api('/v1/admin/coupons', {
                  method: 'POST',
                  body: {
                    code: f.code,
                    percentOff: f.percentOff ? Number(f.percentOff) : null,
                    amountOffKobo: f.amountOffNaira ? Number(f.amountOffNaira) * 100 : null,
                    maxUses: f.maxUses ? Number(f.maxUses) : null,
                    expiresAt: f.expiresAt || null,
                  },
                });
                setF({ code: '', percentOff: '', amountOffNaira: '', maxUses: '', expiresAt: '' });
                await list.reload();
              },
              'Coupon created.',
            );
          }}
        >
          <Field
            label="Code"
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
            required
          />
          <Field
            label="% off"
            inputMode="numeric"
            value={f.percentOff}
            onChange={(e) =>
              setF({ ...f, percentOff: e.target.value.replace(/\D/g, ''), amountOffNaira: '' })
            }
          />
          <Field
            label="or ₦ off"
            inputMode="numeric"
            value={f.amountOffNaira}
            onChange={(e) =>
              setF({ ...f, amountOffNaira: e.target.value.replace(/\D/g, ''), percentOff: '' })
            }
          />
          <Field
            label="Max uses"
            inputMode="numeric"
            value={f.maxUses}
            onChange={(e) => setF({ ...f, maxUses: e.target.value.replace(/\D/g, '') })}
          />
          <Field
            label="Expires"
            type="date"
            value={f.expiresAt}
            onChange={(e) => setF({ ...f, expiresAt: e.target.value })}
          />
          <Button
            type="submit"
            className="sm:col-span-5 sm:justify-self-start"
            loading={action.busy === 'create'}
            disabled={f.code.length < 3 || (!f.percentOff && !f.amountOffNaira)}
          >
            Create
          </Button>
        </form>
        {action.error && (
          <Alert tone="danger" className="mt-3">
            {action.error}
          </Alert>
        )}
      </Card>
      <Table
        caption="Coupons"
        rows={list.data ?? []}
        rowKey={(c) => c.id}
        columns={[
          {
            header: 'Code',
            cell: (c) => <span className="font-mono font-semibold">{c.code}</span>,
          },
          {
            header: 'Discount',
            cell: (c) =>
              c.percentOff ? `${c.percentOff}%` : c.amountOffKobo ? naira(c.amountOffKobo) : '—',
          },
          {
            header: 'Used',
            cell: (c) => (
              <span className="tabular-nums">
                {c.used}
                {c.maxUses ? ` / ${c.maxUses}` : ''}
              </span>
            ),
          },
          { header: 'Expires', cell: (c) => (c.expiresAt ? shortDate(c.expiresAt) : 'Never') },
          {
            header: 'Owner',
            cell: (c) =>
              c.ownerTeacher ? (
                <Badge tone="accent">Teacher: {c.ownerTeacher.user.name}</Badge>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </div>
  );
}
