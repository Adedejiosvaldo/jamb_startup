'use client';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Due {
  linkId: string;
  student: { id: string; name: string | null; phone: string };
  parentPhone: string;
  lastReportSentAt: string | null;
  text: string;
  whatsappUrl: string;
}

/** F-PAR-02 Sunday routine: preview → send on WhatsApp → mark sent. */
export default function ParentReportsPage() {
  const list = useApi<Due[]>('/v1/admin/parent-reports/due');
  const action = useAction();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Parent reports"
        description="Opted-in parents who haven’t had a report in 6+ days. Send on Sunday evening."
      />
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {list.loading && <p className="text-muted">Building reports…</p>}
      {list.data?.length === 0 && (
        <Empty
          title="All parents are up to date"
          action={<span className="text-sm text-muted">Check again next Sunday.</span>}
        />
      )}
      <ul className="space-y-3">
        {list.data?.map((d) => (
          <li key={d.linkId}>
            <Card className="space-y-2">
              <p className="text-sm text-muted">
                {d.student.name ?? d.student.phone} → {d.parentPhone} · last sent{' '}
                {d.lastReportSentAt ? shortDate(d.lastReportSentAt) : 'never'}
              </p>
              <p className="rounded-lg bg-canvas p-3 text-sm text-pretty">{d.text}</p>
              <div className="flex gap-2">
                <a
                  className="inline-flex min-h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent"
                  href={d.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in WhatsApp
                </a>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={action.busy === d.linkId}
                  onClick={() =>
                    void action.run(d.linkId, async () => {
                      await api(`/v1/admin/parent-reports/${d.linkId}/mark-sent`, {
                        method: 'POST',
                      });
                      await list.reload();
                    })
                  }
                >
                  Mark sent
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
