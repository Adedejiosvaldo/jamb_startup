'use client';

import { ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/api';
import { naira } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface PayLink {
  studentFirstName: string | null;
  product: { code: string; name: string };
  amountKobo: number;
  couponCode: string | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
}

/** F-PAR-01: a parent pays from a WhatsApp link without creating an account. */
export default function PayLinkPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, loading } = useApi<PayLink>(`/v1/pay-links/${token}`, { auth: false });
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  if (loading) return <PageSkeleton />;
  if (error || !data)
    return <Alert tone="danger">{error?.message ?? 'This payment link is not valid.'}</Alert>;

  const child = data.studentFirstName ?? 'your child';
  if (data.status === 'paid') {
    return (
      <Alert tone="success" title="Already paid — thank you!">
        {child}’s Season Pass is active.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-balance">Pay for {child}’s JAMB study plan</h1>
        <p className="mt-2 text-pretty text-fg-2">
          {child} asked you to pay for the ScoreCoach Season Pass: a daily study plan, practice with
          explanations, weekly mocks, and a short weekly progress report sent to you on WhatsApp.
        </p>
      </div>
      <Card className="flex items-center justify-between">
        <span className="font-medium">{data.product.name}</span>
        <span className="text-2xl font-bold tabular-nums">{naira(data.amountKobo)}</span>
      </Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setPayError(null);
          api<{ authorizationUrl: string | null }>(`/v1/pay-links/${token}/checkout`, {
            method: 'POST',
            auth: false,
            body: { payerPhone: phone },
          })
            .then((res) => {
              window.location.href = res.authorizationUrl ?? `/pay/${token}/done`;
            })
            .catch((err) => {
              setPayError(errorMessage(err));
              setBusy(false);
            });
        }}
      >
        <Field
          label="Your phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0803 123 4567"
          hint="We’ll send your receipt here by SMS."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={payError}
          required
        />
        <Button type="submit" block size="lg" loading={busy} disabled={!phone.trim()}>
          Pay {naira(data.amountKobo)}
        </Button>
      </form>
      <p className="flex gap-2 text-sm text-pretty text-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
        Card, bank transfer or USSD, processed securely by Paystack. We never see your card details.
        Refund terms: scorecoach.ng/terms. Not affiliated with JAMB.
      </p>
    </div>
  );
}
