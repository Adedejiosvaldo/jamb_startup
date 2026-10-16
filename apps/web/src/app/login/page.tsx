'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ApiError,
  Device,
  replaceDevice,
  requestOtp,
  saveTokens,
  SignInResponse,
  verifyOtp,
} from '@/lib/auth-client';

type Step =
  | { name: 'phone' }
  | { name: 'code' }
  | { name: 'device_limit'; pendingToken: string; devices: Device[] }
  | { name: 'done'; isNewUser: boolean };

const inputClass =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-3 text-lg focus:border-teal-700 focus:outline-none';
const buttonClass =
  'mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-700 px-6 font-semibold text-white disabled:opacity-50';

export default function LoginPage() {
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
      if (err instanceof ApiError && typeof err.body.retryAfterSeconds === 'number') {
        setResendIn(err.body.retryAfterSeconds);
      }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleSignIn(res: SignInResponse) {
    if (res.status === 'signed_in') {
      saveTokens(res.tokens);
      setStep({ name: 'done', isNewUser: res.isNewUser });
    } else {
      setStep({ name: 'device_limit', pendingToken: res.pendingToken, devices: res.devices });
    }
  }

  const sendCode = () =>
    run(async () => {
      const res = await requestOtp(phone);
      setResendIn(res.resendInSeconds);
      setStep({ name: 'code' });
    });

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Sign in</h1>

      {step.name === 'phone' && (
        <form
          className="mt-6"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <label className="block text-sm font-medium" htmlFor="phone">
            Your phone number
          </label>
          <input
            id="phone"
            className={inputClass}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0803 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <p className="mt-2 text-sm text-slate-600">
            We’ll text you a 6-digit code. No password needed.
          </p>
          <button className={buttonClass} disabled={busy || !phone}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      )}

      {step.name === 'code' && (
        <form
          className="mt-6"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run(async () => handleSignIn(await verifyOtp(phone, code)));
          }}
        >
          <label className="block text-sm font-medium" htmlFor="code">
            Enter the code sent to {phone}
          </label>
          <input
            id="code"
            className={`${inputClass} tracking-[0.5em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <button className={buttonClass} disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
          <div className="mt-4 flex justify-between text-sm">
            <button type="button" className="underline" onClick={() => setStep({ name: 'phone' })}>
              Change number
            </button>
            <button
              type="button"
              className="underline disabled:no-underline disabled:opacity-50"
              disabled={resendIn > 0 || busy}
              onClick={() => void sendCode()}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step.name === 'device_limit' && (
        <section className="mt-6">
          <p className="text-slate-700">
            Your account is already signed in on 2 devices. Choose one to sign out so you can use
            this one.
          </p>
          <ul className="mt-4 space-y-3">
            {step.devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <p className="font-medium">{d.label ?? 'Unknown device'}</p>
                  <p className="text-sm text-slate-500">
                    Last used {new Date(d.lastActiveAt).toLocaleDateString('en-NG')}
                  </p>
                </div>
                <button
                  className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => handleSignIn(await replaceDevice(step.pendingToken, d.id)))
                  }
                >
                  Sign out
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step.name === 'done' && (
        <section className="mt-6">
          <p className="text-lg">{step.isNewUser ? 'Welcome to ScoreCoach!' : 'Welcome back!'}</p>
          <p className="mt-2 text-slate-600">Onboarding and the diagnostic are coming next.</p>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </main>
  );
}
