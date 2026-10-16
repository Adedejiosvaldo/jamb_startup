'use client';

import { useState } from 'react';
import { STATUS_TONE } from '@/components/admin/status';
import { Table } from '@/components/admin/table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { dateTime, naira } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Teacher {
  userId: string;
  referralCode: string;
  commissionPct: string;
  verifiedAt: string | null;
  createdAt: string;
  user: { name: string | null; phone: string };
  _count: { classes: number; commissions: number };
}
interface Commission {
  id: string;
  amountKobo: number;
  status: string;
  createdAt: string;
  teacher: { user: { name: string | null; phone: string } };
  order: { paystackReference: string; paidAt: string | null };
}

/** Spec §20: verify by phone call, then set commission and student discount. */
export default function TeachersAdmin() {
  const teachers = useApi<Teacher[]>('/v1/admin/teachers');
  const owed = useApi<Commission[]>('/v1/admin/commissions?status=owed');
  const action = useAction();
  const [verifying, setVerifying] = useState<Teacher | null>(null);
  const [terms, setTerms] = useState({ commissionPct: 20, discountPct: 10 });

  const totalOwed = owed.data?.reduce((s, c) => s + c.amountKobo, 0) ?? 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Teachers" />
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {action.notice && <Alert tone="success">{action.notice}</Alert>}
      <Table
        caption="Teachers"
        rows={teachers.data ?? []}
        rowKey={(t) => t.userId}
        empty={teachers.loading ? 'Loading…' : 'No applications yet.'}
        columns={[
          { header: 'Teacher', cell: (t) => `${t.user.name ?? '—'} · ${t.user.phone}` },
          { header: 'Code', cell: (t) => <span className="font-mono">{t.referralCode}</span> },
          { header: 'Classes', cell: (t) => t._count.classes },
          { header: 'Sales', cell: (t) => t._count.commissions },
          { header: 'Commission', cell: (t) => `${Number(t.commissionPct)}%` },
          {
            header: 'Status',
            cell: (t) =>
              t.verifiedAt ? (
                <Badge tone="success">verified</Badge>
              ) : (
                <Button size="sm" onClick={() => setVerifying(t)}>
                  Verify
                </Button>
              ),
          },
        ]}
      />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            Commissions owed · <span className="tabular-nums">{naira(totalOwed)}</span>
          </h2>
          {owed.data && owed.data.length > 0 && (
            <Button
              size="sm"
              loading={action.busy === 'payout'}
              onClick={() =>
                void action.run(
                  'payout',
                  async () => {
                    await api('/v1/admin/commissions/mark-paid', {
                      method: 'POST',
                      body: { ids: owed.data!.map((c) => c.id) },
                    });
                    await owed.reload();
                  },
                  'Marked as paid. Make sure the bank transfers went out.',
                )
              }
            >
              Mark all paid
            </Button>
          )}
        </div>
        <Table
          caption="Owed commissions"
          rows={owed.data ?? []}
          rowKey={(c) => c.id}
          empty="Nothing owed."
          columns={[
            {
              header: 'Teacher',
              cell: (c) => `${c.teacher.user.name ?? '—'} · ${c.teacher.user.phone}`,
            },
            {
              header: 'Amount',
              cell: (c) => <span className="tabular-nums">{naira(c.amountKobo)}</span>,
            },
            { header: 'Sale', cell: (c) => (c.order.paidAt ? dateTime(c.order.paidAt) : '—') },
            {
              header: 'Status',
              cell: (c) => <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>,
            },
          ]}
        />
      </section>

      <Dialog
        open={!!verifying}
        onOpenChange={(o) => !o && setVerifying(null)}
        title={`Verify ${verifying?.user.name ?? ''}`}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(
              'verify',
              async () => {
                await api(`/v1/admin/teachers/${verifying!.userId}/verify`, {
                  method: 'POST',
                  body: terms,
                });
                setVerifying(null);
                await teachers.reload();
              },
              'Teacher verified. Their code is live.',
            );
          }}
        >
          <p className="text-sm text-fg-2">
            Only verify after a call. Their code {verifying?.referralCode} becomes a student
            discount.
          </p>
          <Field
            label="Commission %"
            inputMode="decimal"
            value={terms.commissionPct}
            onChange={(e) => setTerms({ ...terms, commissionPct: Number(e.target.value) || 0 })}
          />
          <Field
            label="Student discount %"
            inputMode="numeric"
            value={terms.discountPct}
            onChange={(e) => setTerms({ ...terms, discountPct: Number(e.target.value) || 0 })}
          />
          <Button type="submit" block loading={action.busy === 'verify'}>
            Verify teacher
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
