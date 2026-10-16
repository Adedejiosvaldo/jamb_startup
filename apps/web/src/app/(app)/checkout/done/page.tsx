'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/api';
import { supportWaLink } from '@/lib/config';
import { shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';

type Status = 'checking' | 'paid' | 'failed' | 'slow';

/** Paystack redirects here. The server verifies with Paystack before anything unlocks (F-BILL-04). */
function Done() {
  const params = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref') ?? '';
  const { reload } = useSession();
  const [status, setStatus] = useState<Status>('checking');
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      tries.current += 1;
      try {
        const res = await api<{ status: string; plan: { endsAt: string } | null }>(
          `/v1/checkout/verify?reference=${encodeURIComponent(reference)}`,
        );
        if (res.status === 'paid') {
          setEndsAt(res.plan?.endsAt ?? null);
          setStatus('paid');
          await reload();
          return;
        }
        if (res.status === 'failed') {
          setStatus('failed');
          return;
        }
      } catch (e) {
        setError(errorMessage(e));
      }
      if (tries.current >= 20) setStatus('slow');
      else timer = setTimeout(check, 3000);
    }
    if (reference) void check();
    return () => clearTimeout(timer);
  }, [reference, reload]);

  const help = supportWaLink(`My payment hasn't unlocked. Reference: ${reference}`);
  return (
    <div className="space-y-6 py-6 text-center">
      {status === 'checking' && (
        <>
          <Loader2
            aria-hidden="true"
            className="mx-auto size-10 text-teal-700 motion-safe:animate-spin"
          />
          <h1 className="text-2xl font-bold">Confirming your payment…</h1>
          <p className="text-slate-600" role="status">
            This usually takes a few seconds. Don’t close this page.
          </p>
        </>
      )}
      {status === 'paid' && (
        <>
          <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-green-700" />
          <h1 className="text-2xl font-bold text-balance">Your Season Pass is active</h1>
          {endsAt && (
            <p className="text-slate-600">
              Active until {shortDate(endsAt)}. A receipt is on its way by SMS.
            </p>
          )}
          <ButtonLink href="/home" size="lg">
            Go to my plan
          </ButtonLink>
        </>
      )}
      {status === 'failed' && (
        <>
          <h1 className="text-2xl font-bold">Payment didn’t go through</h1>
          <p className="text-slate-600">You haven’t been charged. You can try again.</p>
          <ButtonLink href="/upgrade">Try again</ButtonLink>
        </>
      )}
      {status === 'slow' && (
        <Alert tone="warning" title="Still waiting for confirmation">
          If money left your account, it’s safe — your plan will unlock as soon as Paystack
          confirms.{' '}
          {help && (
            <a className="font-semibold underline" href={help}>
              Message support
            </a>
          )}{' '}
          with reference <span className="font-mono">{reference.slice(-10)}</span>.
        </Alert>
      )}
      {error && status !== 'paid' && <p className="text-sm text-slate-600">{error}</p>}
    </div>
  );
}

export default function CheckoutDonePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Done />
    </Suspense>
  );
}
