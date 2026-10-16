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
  'Daily plan on your weakest topics',
  'Unlimited practice + explanations',
  'Mistake review (1·3·7·14 days)',
  'Weekly mini-mock + full CBT mocks',
  'Speed drills',
  'Weekly parent report',
  'WhatsApp support in 12 hours',
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
      <PageHeader title="Season Pass" description="One payment. Until a week after your UTME." />
      {reason && <Alert tone="info">{reason}</Alert>}

      <Card className="relative space-y-5 overflow-hidden border-emerald-400/30 p-6">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 size-64 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent"
        />
        {quote.loading && !q ? (
          <Skeleton className="h-12 w-40" />
        ) : q ? (
          <div>
            <p className="relative text-5xl font-semibold tabular-nums">{naira(q.amountKobo)}</p>
            {q.discountKobo > 0 && (
              <p className="text-sm text-muted">
                <span className="line-through tabular-nums">{naira(q.product.priceKobo)}</span> ·
                code {q.coupon?.code} saves{' '}
                <span className="tabular-nums">{naira(q.discountKobo)}</span>
              </p>
            )}
          </div>
        ) : null}
        <ul className="relative grid gap-2.5 text-sm text-fg-2 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-2 text-pretty">
              <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent" />
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
          <p className="rounded-lg bg-canvas p-3 text-sm text-pretty text-fg-2">{link.message}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={link.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong"
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
          <p className="text-sm text-muted">
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
      <p className="text-sm text-pretty text-muted">
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
