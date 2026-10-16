'use client';

import { Check, Copy, MessageCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { api, errorMessage, storage, track } from '@/lib/api';
import { naira, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';

interface Quote {
  product: { code: string; name: string; priceKobo: number };
  coupon: { code: string } | null;
  discountKobo: number;
  amountKobo: number;
}

const FEATURES = [
  'A daily plan built on your weakest high-value topics',
  'Unlimited practice with step-by-step explanations',
  'Mistake review: wrong answers come back at 1, 3, 7 and 14 days',
  'Weekly mini-mock and full 2-hour CBT mocks',
  'Speed drills to beat the clock in Maths',
  'Weekly WhatsApp progress report for your parent',
  'Support on WhatsApp, reply within 12 hours',
];

function Upgrade() {
  const { me } = useSession();
  const params = useSearchParams();
  const reason = params.get('reason');
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<string | undefined>(undefined);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pay' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; message: string; whatsappUrl: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const quote = useApi<Quote>(
    `/v1/quote?product=SEASON_PASS${applied ? `&coupon=${encodeURIComponent(applied)}` : ''}`,
    { auth: false },
  );

  useEffect(() => {
    track('paywall_viewed', { reason });
    const saved = storage.get('sc.coupon');
    if (saved) {
      setCoupon(saved);
      setApplied(saved);
    }
  }, [reason]);

  useEffect(() => {
    if (quote.error && applied) {
      setCouponError(quote.error.message);
      setApplied(undefined);
      storage.set('sc.coupon', null);
    }
  }, [quote.error, applied]);

  if (me?.plan.paid) {
    return (
      <Alert tone="success" title="You have the Season Pass">
        Active until {shortDate(me.plan.endsAt)}.
      </Alert>
    );
  }

  async function pay() {
    setBusy('pay');
    setError(null);
    try {
      const res = await api<{ authorizationUrl: string | null; reference: string }>(
        '/v1/checkout',
        {
          method: 'POST',
          body: { productCode: 'SEASON_PASS', couponCode: applied },
        },
      );
      window.location.href = res.authorizationUrl ?? `/checkout/done?reference=${res.reference}`;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  async function askParent() {
    setBusy('link');
    setError(null);
    try {
      const res = await api<{ url: string; message: string; whatsappUrl: string }>('/v1/pay-link', {
        method: 'POST',
        body: { productCode: 'SEASON_PASS', couponCode: applied },
      });
      setLink(res);
      track('pay_link_created');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const q = quote.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Season Pass"
        description="One payment. Lasts until a week after your UTME."
      />
      {reason && <Alert tone="info">{reason}</Alert>}

      <Card className="space-y-4 border-2 border-teal-700">
        {quote.loading && !q ? (
          <Skeleton className="h-12 w-40" />
        ) : q ? (
          <div>
            <p className="text-4xl font-bold tabular-nums">{naira(q.amountKobo)}</p>
            {q.discountKobo > 0 && (
              <p className="text-sm text-slate-600">
                <span className="line-through tabular-nums">{naira(q.product.priceKobo)}</span> ·
                code {q.coupon?.code} saves{' '}
                <span className="tabular-nums">{naira(q.discountKobo)}</span>
              </p>
            )}
          </div>
        ) : null}
        <ul className="space-y-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-2 text-pretty">
              <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-teal-700" />
              {f}
            </li>
          ))}
        </ul>
      </Card>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCouponError(null);
          const c = coupon.trim().toUpperCase();
          setApplied(c || undefined);
          storage.set('sc.coupon', c || null);
        }}
      >
        <Field
          label="Discount code"
          className="flex-1"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          error={couponError}
          autoCapitalize="characters"
        />
        <Button type="submit" variant="secondary" className={couponError ? 'mb-7' : ''}>
          Apply
        </Button>
      </form>

      {link ? (
        <Card className="space-y-3">
          <CardTitle>Send this to your parent</CardTitle>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-pretty text-slate-700">
            {link.message}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={link.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 font-semibold text-white hover:bg-teal-800"
            >
              <MessageCircle aria-hidden="true" className="size-5" /> Share on WhatsApp
            </a>
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(link.url).then(() => setCopied(true));
              }}
            >
              <Copy aria-hidden="true" className="size-4" /> {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <p className="text-sm text-slate-600">
            Your plan unlocks automatically as soon as they pay. You’ll get an SMS.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <Button
            block
            size="lg"
            loading={busy === 'pay'}
            disabled={!!busy}
            onClick={() => void pay()}
          >
            Pay now — card, transfer or USSD
          </Button>
          <Button
            block
            size="lg"
            variant="secondary"
            loading={busy === 'link'}
            disabled={!!busy}
            onClick={() => void askParent()}
          >
            <MessageCircle aria-hidden="true" className="size-5" /> Ask my parent to pay
          </Button>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-sm text-pretty text-slate-600">
        Payments are processed securely by Paystack. We never see your card details. Plans are
        linked to your phone number, so you keep access if you change phones. See{' '}
        <a className="underline" href="/terms">
          refund terms
        </a>
        .
      </p>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Upgrade />
    </Suspense>
  );
}
