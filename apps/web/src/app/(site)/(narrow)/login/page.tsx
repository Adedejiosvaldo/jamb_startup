'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/logo';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  api,
  ApiError,
  deviceFingerprint,
  deviceLabel,
  errorMessage,
  setTokens,
  type Tokens,
} from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useSession } from '@/lib/session';

interface Device {
  id: string;
  label: string | null;
  lastActiveAt: string;
}
type SignIn =
  | { status: 'signed_in'; isNewUser: boolean; user: { role: string }; tokens: Tokens }
  | { status: 'device_limit'; pendingToken: string; devices: Device[] };

type Step =
  | { name: 'phone' }
  | { name: 'code' }
  | { name: 'device_limit'; pendingToken: string; devices: Device[] };

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const session = useSession();
  const [step, setStep] = useState<Step>({ name: 'phone' });
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError && typeof err.body.retryAfterSeconds === 'number')
        setResendIn(err.body.retryAfterSeconds);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function finish(res: SignIn) {
    if (res.status === 'device_limit') {
      setStep({ name: 'device_limit', pendingToken: res.pendingToken, devices: res.devices });
      return;
    }
    setTokens(res.tokens);
    const me = await session.reload();
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    if (me && (me.role === 'admin' || me.role === 'reviewer')) router.replace(safeNext ?? '/admin');
    else if (me?.role === 'teacher' || safeNext?.startsWith('/teacher'))
      router.replace(safeNext ?? '/teacher');
    else if (!me?.profile?.onboardingDone) router.replace('/onboarding');
    else router.replace(safeNext ?? '/home');
  }

  const sendCode = () =>
    run(async () => {
      const res = await api<{ resendInSeconds: number }>('/v1/auth/otp/request', {
        method: 'POST',
        body: { phone },
        auth: false,
      });
      setResendIn(res.resendInSeconds);
      setCode('');
      setStep({ name: 'code' });
    });

  const verify = () =>
    run(async () => {
      const res = await api<SignIn>('/v1/auth/otp/verify', {
        method: 'POST',
        auth: false,
        ok: [409],
        body: {
          phone,
          code,
          device: {
            fingerprint: deviceFingerprint(),
            userAgent: navigator.userAgent,
            label: deviceLabel(),
          },
        },
      });
      await finish(res);
    });

  return (
    <div className="mx-auto max-w-sm">
      <div className="glass rounded-3xl border border-line-strong p-6 shadow-2xl sm:p-8">
        <LogoMark className="size-10" />
        <h1 className="mt-5 text-2xl font-semibold text-balance">
          {step.name === 'device_limit'
            ? 'Too many devices'
            : step.name === 'code'
              ? 'Check your SMS'
              : 'Sign in'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {step.name === 'device_limit'
            ? 'Sign one out to use this device.'
            : step.name === 'code'
              ? `6-digit code sent to ${phone}`
              : 'New here? Same step — we’ll create your account.'}
        </p>

        {step.name === 'phone' && (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <Field
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={error}
              required
            />
            <Button type="submit" block loading={busy} disabled={!phone.trim()}>
              {busy ? 'Sending code…' : 'Send code'}
            </Button>
          </form>
        )}

        {step.name === 'code' && (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void verify();
            }}
          >
            <Field
              label="Code"
              inputMode="numeric"
              autoFocus
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              className="[&_input]:text-center [&_input]:font-mono [&_input]:text-3xl [&_input]:tabular-nums"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
              }}
              error={error}
              required
            />
            <Button type="submit" block loading={busy} disabled={code.length !== 6}>
              {busy ? 'Checking…' : 'Continue'}
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="min-h-11 underline"
                onClick={() => setStep({ name: 'phone' })}
              >
                Change number
              </button>
              <button
                type="button"
                className="min-h-11 tabular-nums underline disabled:no-underline disabled:opacity-60"
                disabled={resendIn > 0 || busy}
                onClick={() => void sendCode()}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {step.name === 'device_limit' && (
          <section className="mt-4 space-y-4">
            <p className="text-pretty text-fg-2">
              Your account is signed in on 2 devices already. Sign one out to use this device.
            </p>
            <ul className="space-y-3">
              {step.devices.map((d) => (
                <li key={d.id}>
                  <Card className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.label ?? 'Unknown device'}</p>
                      <p className="text-sm text-muted">Last used {dateTime(d.lastActiveAt)}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(async () =>
                          finish(
                            await api<SignIn>('/v1/auth/devices/replace', {
                              method: 'POST',
                              auth: false,
                              ok: [409],
                              body: { pendingToken: step.pendingToken, revokeDeviceId: d.id },
                            }),
                          ),
                        )
                      }
                    >
                      Sign out
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
            {error && <Alert tone="danger">{error}</Alert>}
          </section>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        By continuing you agree to our terms. Not affiliated with JAMB.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Login />
    </Suspense>
  );
}
