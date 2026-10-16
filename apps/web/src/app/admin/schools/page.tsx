'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import type { Subject } from '@/lib/types';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

interface School {
  id: string;
  name: string;
  lga: string | null;
  state: string | null;
  contactName: string | null;
  contactPhone: string | null;
  events: {
    id: string;
    name: string | null;
    date: string;
    type: string;
    _count: { entries: number };
  }[];
}

export default function SchoolsPage() {
  const schools = useApi<School[]>('/v1/admin/schools');
  const subjects = useApi<Subject[]>('/v1/subjects', { auth: false });
  const action = useAction();
  const [form, setForm] = useState({
    name: '',
    lga: '',
    state: 'Lagos',
    contactName: '',
    contactPhone: '',
  });
  const [eventFor, setEventFor] = useState<School | null>(null);
  const [ev, setEv] = useState({
    date: '',
    name: '',
    subjects: ['ENG', 'MTH'],
    perSubject: 20,
    couponCode: '',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schools"
        description="Mock-day operations (spec §19): create the event, print papers, enter answers, print reports."
      />
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      <Card>
        <CardTitle>Add a school</CardTitle>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run('school', async () => {
              await api('/v1/admin/schools', { method: 'POST', body: form });
              setForm({ name: '', lga: '', state: 'Lagos', contactName: '', contactPhone: '' });
              await schools.reload();
            });
          }}
        >
          <Field
            label="School name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Field
            label="LGA"
            value={form.lga}
            onChange={(e) => setForm({ ...form, lga: e.target.value })}
          />
          <Field
            label="Contact (principal)"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
          <Field
            label="Contact phone"
            type="tel"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          />
          <Button
            type="submit"
            className="sm:col-span-2 sm:justify-self-start"
            loading={action.busy === 'school'}
            disabled={form.name.length < 2}
          >
            Add school
          </Button>
        </form>
      </Card>

      <ul className="space-y-3">
        {schools.data?.map((s) => (
          <li key={s.id}>
            <Card className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-slate-600">
                    {[s.lga, s.state].filter(Boolean).join(', ')}{' '}
                    {s.contactName && `· ${s.contactName}`}{' '}
                    {s.contactPhone && `· ${s.contactPhone}`}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEventFor(s)}>
                  New mock day
                </Button>
              </div>
              {s.events.length > 0 && (
                <ul className="divide-y divide-slate-100 text-sm">
                  {s.events.map((e) => (
                    <li key={e.id} className="flex justify-between py-2">
                      <Link
                        className="text-teal-800 underline-offset-4 hover:underline"
                        href={`/admin/schools/events/${e.id}`}
                      >
                        {e.name || 'Mock day'} · {shortDate(e.date)}
                      </Link>
                      <span className="tabular-nums">
                        {e._count.entries} student{e._count.entries === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!eventFor}
        onOpenChange={(o) => !o && setEventFor(null)}
        title={`Mock day at ${eventFor?.name ?? ''}`}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run('event', async () => {
              await api(`/v1/admin/schools/${eventFor!.id}/events`, {
                method: 'POST',
                body: {
                  ...ev,
                  name: ev.name.trim() || undefined,
                  couponCode: ev.couponCode || undefined,
                },
              });
              setEventFor(null);
              await schools.reload();
            });
          }}
        >
          <Field
            label="Date"
            type="date"
            value={ev.date}
            onChange={(e) => setEv({ ...ev, date: e.target.value })}
            required
          />
          <Field
            label="Name"
            placeholder="SS3 paper mock"
            value={ev.name}
            onChange={(e) => setEv({ ...ev, name: e.target.value })}
          />
          <fieldset>
            <legend className="text-sm font-medium">Subjects on the paper (up to 4)</legend>
            <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
              {subjects.data?.map((s) => (
                <label key={s.code} className="flex min-h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-teal-700"
                    checked={ev.subjects.includes(s.code)}
                    disabled={!ev.subjects.includes(s.code) && ev.subjects.length >= 4}
                    onChange={() =>
                      setEv({
                        ...ev,
                        subjects: ev.subjects.includes(s.code)
                          ? ev.subjects.filter((c) => c !== s.code)
                          : [...ev.subjects, s.code],
                      })
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Field
            label="Questions per subject"
            inputMode="numeric"
            value={ev.perSubject}
            onChange={(e) =>
              setEv({ ...ev, perSubject: Number(e.target.value.replace(/\D/g, '')) || 0 })
            }
          />
          <Field
            label="Coupon on reports"
            hint="e.g. the school name. Create it under Coupons first."
            value={ev.couponCode}
            onChange={(e) => setEv({ ...ev, couponCode: e.target.value.toUpperCase() })}
          />
          <Button
            type="submit"
            block
            loading={action.busy === 'event'}
            disabled={!ev.date || !ev.subjects.length}
          >
            Create and generate paper
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
