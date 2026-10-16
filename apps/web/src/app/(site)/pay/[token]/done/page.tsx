'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { supportWaLink } from '@/lib/config';

export default function PayLinkDone() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'checking' | 'paid' | 'failed' | 'slow'>('checking');

  useEffect(() => {
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      n += 1;
      try {
        const res = await api<{ status: string }>(`/v1/pay-links/${token}/verify`, { auth: false });
        if (res.status === 'paid') return setStatus('paid');
        if (res.status === 'failed') return setStatus('failed');
      } catch {
        /* retry */
      }
      if (n >= 20) setStatus('slow');
      else timer = setTimeout(check, 3000);
    };
    void check();
    return () => clearTimeout(timer);
  }, [token]);

  const help = supportWaLink('I paid with a parent link but it has not confirmed.');
  return (
    <div className="space-y-4 py-6 text-center">
      {status === 'checking' && (
        <>
          <Loader2
            aria-hidden="true"
            className="mx-auto size-10 text-teal-700 motion-safe:animate-spin"
          />
          <h1 className="text-2xl font-bold">Confirming payment…</h1>
        </>
      )}
      {status === 'paid' && (
        <>
          <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-green-700" />
          <h1 className="text-2xl font-bold text-balance">Thank you! The plan is now active.</h1>
          <p className="text-pretty text-slate-700">
            Your receipt is on its way by SMS. We’ll ask before sending you any weekly reports.
          </p>
        </>
      )}
      {status === 'failed' && (
        <Alert tone="danger" title="Payment didn’t go through">
          You have not been charged. Go back to the link to try again.
        </Alert>
      )}
      {status === 'slow' && (
        <Alert tone="warning" title="Still waiting for the bank">
          If money left your account it is safe; the plan unlocks as soon as Paystack confirms.{' '}
          {help && (
            <a className="font-semibold underline" href={help}>
              Message support
            </a>
          )}
        </Alert>
      )}
    </div>
  );
}
