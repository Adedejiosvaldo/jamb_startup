'use client';

import { ChevronRight, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api, errorMessage, storage } from '@/lib/api';
import { supportWaLink } from '@/lib/config';
import { dateTime, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';

interface Device {
  id: string;
  label: string | null;
  lastActiveAt: string;
  current?: boolean;
}

export default function AccountPage() {
  const { me, reload, signOut } = useSession();
  const router = useRouter();
  const devices = useApi<{ devices: Device[] }>('/v1/me/devices');
  const [removing, setRemoving] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [parentPhone, setParentPhone] = useState('');
  const [parentMsg, setParentMsg] = useState<{ shareUrl: string } | null>(null);
  const [classCode, setClassCode] = useState(storage.get('sc.class') ?? '');
  const [classMsg, setClassMsg] = useState<string | null>(null);
  const [error, setError] = useState<{ section: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteSent, setDeleteSent] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  if (!me) return null;
  const help = supportWaLink();

  async function act(section: string, fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError({ section, message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Account" description={`${me.name ?? 'Student'} · ${me.phone}`} />

      <Card className="space-y-2">
        <CardTitle>Plan</CardTitle>
        {me.plan.paid ? (
          <p>
            <Badge tone="success">Season Pass</Badge>{' '}
            <span className="text-fg-2">active until {shortDate(me.plan.endsAt)}</span>
          </p>
        ) : (
          <>
            <p className="text-fg-2">Free plan</p>
            <ButtonLink href="/upgrade" size="sm">
              Get the Season Pass
            </ButtonLink>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Study profile</CardTitle>
          <Link
            href="/onboarding"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
          >
            Edit <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Exam</dt>
          <dd>UTME {me.examYear ?? '—'}</dd>
          <dt className="text-muted">Target</dt>
          <dd className="text-pretty">
            {me.profile?.targetCourse
              ? `${me.profile.targetCourse.name}, ${me.profile.targetUniversity?.shortName ?? me.profile.targetUniversity?.name}`
              : 'Not set'}
            {me.profile?.targetScore ? ` · ${me.profile.targetScore}+` : ''}
          </dd>
          <dt className="text-muted">Subjects</dt>
          <dd className="text-pretty">{me.subjects.map((s) => s.name).join(', ')}</dd>
          <dt className="text-muted">Daily time</dt>
          <dd>{me.profile?.dailyMinutes ?? '—'} minutes</dd>
        </dl>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Parent reports</CardTitle>
        {me.parent && !parentMsg ? (
          <p className="text-sm text-fg-2">
            {me.parent.phone} ·{' '}
            {me.parent.optedIn ? (
              <Badge tone="success">Receiving weekly reports</Badge>
            ) : (
              <Badge tone="warning">Waiting for them to agree</Badge>
            )}
          </p>
        ) : null}
        {parentMsg ? (
          <Alert tone="success" title="Request ready">
            <a
              href={parentMsg.shareUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
            >
              Send it on WhatsApp
            </a>
          </Alert>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act('parent', async () => {
                setParentMsg(
                  await api<{ shareUrl: string }>('/v1/me/parent-link', {
                    method: 'POST',
                    body: { parentPhone },
                  }),
                );
                await reload();
              });
            }}
          >
            <Field
              label={me.parent ? 'Change parent number' : "Parent's WhatsApp number"}
              className="flex-1"
              type="tel"
              inputMode="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              error={error?.section === 'parent' ? error.message : null}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!parentPhone.trim() || busy}
              className={error?.section === 'parent' ? 'mb-7' : ''}
            >
              Add
            </Button>
          </form>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>Lesson class</CardTitle>
        <p className="text-sm text-muted">
          If your lesson teacher gave you a class code, enter it so they can follow your progress.
        </p>
        {classMsg ? (
          <Alert tone="success">{classMsg}</Alert>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act('class', async () => {
                const res = await api<{ class: { name: string; teacher: string } }>(
                  '/v1/classes/join',
                  { method: 'POST', body: { code: classCode } },
                );
                storage.set('sc.class', null);
                setClassMsg(`You joined ${res.class.name} with ${res.class.teacher}.`);
              });
            }}
          >
            <Field
              label="Class code"
              className="flex-1"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              error={error?.section === 'class' ? error.message : null}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!classCode.trim() || busy}
              className={error?.section === 'class' ? 'mb-7' : ''}
            >
              Join
            </Button>
          </form>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>Devices</CardTitle>
        <p className="text-sm text-muted">You can be signed in on up to 2 devices.</p>
        <ul className="divide-y divide-line">
          {devices.data?.devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {d.label ?? 'Unknown device'}{' '}
                  {d.current && <Badge tone="accent">This device</Badge>}
                </p>
                <p className="text-sm text-muted">Last used {dateTime(d.lastActiveAt)}</p>
              </div>
              {!d.current && (
                <Button size="sm" variant="secondary" onClick={() => setRemoving(d)}>
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <CardTitle>Help</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row">
          {help && (
            <a
              href={help}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong px-4 font-semibold"
            >
              <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp support
            </a>
          )}
          <ButtonLink href="/support" variant="secondary">
            Report a problem
          </ButtonLink>
          <ButtonLink href="/help" variant="ghost">
            Help centre
          </ButtonLink>
        </div>
      </Card>

      <div className="space-y-3">
        <Button block variant="secondary" onClick={() => setConfirmSignOut(true)}>
          Sign out
        </Button>
        {deleteSent ? (
          <Alert tone="info">
            We’ve received your deletion request and will complete it within 30 days. We’ll confirm
            by SMS.
          </Alert>
        ) : (
          <button
            type="button"
            className="min-h-11 w-full text-sm text-red-400 underline"
            onClick={() => setConfirmDelete(true)}
          >
            Delete my account and data
          </button>
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Sign out ${removing?.label ?? 'this device'}?`}
        description="It will need to sign in again with a code."
        confirmLabel="Sign out device"
        busy={busy}
        onConfirm={() =>
          void act('devices', async () => {
            await api(`/v1/me/devices/${removing!.id}`, { method: 'DELETE' });
            setRemoving(null);
            await devices.reload();
          })
        }
      />
      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out?"
        description="Any answers not yet saved to the server stay on this phone until you sign in again."
        confirmLabel="Sign out"
        onConfirm={() =>
          void signOut().then(() => {
            router.replace('/');
          })
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        danger
        title="Delete your account?"
        description="We’ll delete your profile and learning data within 30 days. Payment records are kept as the law requires. This can’t be undone."
        confirmLabel="Request deletion"
        busy={busy}
        onConfirm={() =>
          void act('delete', async () => {
            await api('/v1/support/tickets', {
              method: 'POST',
              body: {
                category: 'other',
                body: 'Account deletion request (F-ACC-05).',
                context: { kind: 'account_deletion' },
              },
            });
            setConfirmDelete(false);
            setDeleteSent(true);
          })
        }
      />
      {error && !['parent', 'class'].includes(error.section) && (
        <Alert tone="danger">{error.message}</Alert>
      )}
    </div>
  );
}
