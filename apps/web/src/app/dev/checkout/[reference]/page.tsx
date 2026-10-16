'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';

/** Local development stand-in for the Paystack checkout page (PAYMENT_PROVIDER=fake). */
export default function DevCheckout() {
  const { reference } = useParams<{ reference: string }>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main id="main" className="mx-auto max-w-md space-y-4 px-4 py-12">
      <Alert tone="warning" title="Development payment page">
        This replaces Paystack locally. No money moves.
      </Alert>
      <p className="font-mono text-sm break-all text-muted">{reference}</p>
      <Button
        block
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/v1/dev/payments/${reference}/succeed`, { method: 'POST', auth: false });
            const ref = document.referrer;
            window.location.href = ref.includes('/pay/')
              ? `${ref.replace(/\/$/, '')}/done`
              : `/checkout/done?reference=${encodeURIComponent(reference)}`;
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }}
      >
        Simulate successful payment
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </main>
  );
}
