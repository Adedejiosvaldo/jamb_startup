'use client';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface Msg {
  id: string;
  phone: string;
  template: string;
  payload: { text?: string };
  createdAt: string;
}

/** Manual-first WhatsApp (spec principle 6) until Cloud API templates are approved. */
export default function OutboxPage() {
  const list = useApi<Msg[]>('/v1/admin/outbox');
  const action = useAction();
  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp outbox"
        description="Open each in WhatsApp Business, send, then mark as sent."
      />
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {list.data?.length === 0 && (
        <Empty
          title="Nothing to send"
          action={
            <span className="text-sm text-slate-600">
              New parent opt-in requests will appear here.
            </span>
          }
        />
      )}
      <ul className="space-y-3">
        {list.data?.map((m) => (
          <li key={m.id}>
            <Card className="space-y-2">
              <p className="text-sm">
                <Badge>{m.template}</Badge> to {m.phone} · {dateTime(m.createdAt)}
              </p>
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-pretty">{m.payload.text}</p>
              <div className="flex gap-2">
                <a
                  className="inline-flex min-h-9 items-center rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white"
                  href={`https://wa.me/${m.phone.replace('+', '')}?text=${encodeURIComponent(m.payload.text ?? '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in WhatsApp
                </a>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={action.busy === m.id}
                  onClick={() =>
                    void action.run(m.id, async () => {
                      await api(`/v1/admin/outbox/${m.id}/mark-sent`, { method: 'POST' });
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
