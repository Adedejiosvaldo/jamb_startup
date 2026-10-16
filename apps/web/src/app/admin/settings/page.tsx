'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field, TextareaField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

const defaultYear =
  new Date().getMonth() >= 5 ? new Date().getFullYear() + 1 : new Date().getFullYear();

/** Exam rules are data (spec §6.1) + verified announcements (F-JRN-01). */
export default function SettingsPage() {
  const [year, setYear] = useState(defaultYear);
  const cfg = useApi<Record<string, unknown>>(`/v1/exam-config/${year}`, { auth: false });
  const news = useApi<
    {
      id: string;
      title: string;
      body: string;
      officialSourceUrl: string | null;
      publishedAt: string | null;
    }[]
  >('/v1/admin/announcements');
  const action = useAction();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [a, setA] = useState({ title: '', body: '', officialSourceUrl: '' });

  return (
    <div className="space-y-6">
      <PageHeader title="Exam config & news" />
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {action.notice && <Alert tone="success">{action.notice}</Alert>}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <CardTitle>Exam rules for UTME {year}</CardTitle>
          <Field
            label="Year"
            inputMode="numeric"
            className="w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
          />
        </div>
        <Alert tone="warning">
          Confirm every value against the official JAMB brochure. `utme_window.start` drives
          countdowns and season-pass end dates.
        </Alert>
        <ul className="space-y-3">
          {[
            ...Object.entries(cfg.data ?? {}),
            ...(newKey && !(newKey in (cfg.data ?? {}))
              ? [[newKey, null] as [string, unknown]]
              : []),
          ].map(([k, v]) => {
            const draft = drafts[k] ?? JSON.stringify(v);
            let valid = true;
            try {
              JSON.parse(draft);
            } catch {
              valid = false;
            }
            return (
              <li key={k} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
                <code className="pt-2 text-sm font-semibold">{k}</code>
                <Field
                  label={`Value for ${k} (JSON)`}
                  className="[&_input]:font-mono [&_input]:text-sm [&_label]:sr-only"
                  value={draft}
                  onChange={(e) => setDrafts({ ...drafts, [k]: e.target.value })}
                  error={valid ? null : 'Not valid JSON'}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!valid || drafts[k] === undefined}
                  loading={action.busy === k}
                  onClick={() =>
                    void action.run(
                      k,
                      async () => {
                        await api(`/v1/admin/exam-config/${year}/${k}`, {
                          method: 'PUT',
                          body: { value: JSON.parse(draft) },
                        });
                        setDrafts(({ [k]: _drop, ...rest }) => rest);
                        if (k === newKey) setNewKey('');
                        await cfg.reload();
                      },
                      `${k} saved.`,
                    )
                  }
                >
                  Save
                </Button>
              </li>
            );
          })}
        </ul>
        <Field
          label="Add a key"
          className="max-w-xs"
          placeholder="e.g. registration_fee_kobo"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value.replace(/[^a-z_]/g, ''))}
        />
      </Card>

      <Card className="space-y-3">
        <CardTitle>New verified update</CardTitle>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(
              'news',
              async () => {
                await api('/v1/admin/announcements', {
                  method: 'POST',
                  body: {
                    ...a,
                    officialSourceUrl: a.officialSourceUrl || undefined,
                    publish: true,
                  },
                });
                setA({ title: '', body: '', officialSourceUrl: '' });
                await news.reload();
              },
              'Published to the app.',
            );
          }}
        >
          <Field
            label="Title"
            value={a.title}
            onChange={(e) => setA({ ...a, title: e.target.value })}
            required
          />
          <TextareaField
            label="Message"
            value={a.body}
            onChange={(e) => setA({ ...a, body: e.target.value })}
            required
          />
          <Field
            label="Official JAMB source link"
            type="url"
            hint="Every post should link to the official source."
            value={a.officialSourceUrl}
            onChange={(e) => setA({ ...a, officialSourceUrl: e.target.value })}
          />
          <Button type="submit" loading={action.busy === 'news'}>
            Publish
          </Button>
        </form>
        <ul className="divide-y divide-line text-sm">
          {news.data?.map((n) => (
            <li key={n.id} className="py-2">
              <p className="font-medium">
                {n.title}{' '}
                {n.publishedAt ? (
                  <Badge tone="success">{dateTime(n.publishedAt)}</Badge>
                ) : (
                  <Badge>draft</Badge>
                )}
              </p>
              <p className="text-fg-2">{n.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
