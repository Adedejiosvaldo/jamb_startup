import type { Metadata } from 'next';
import { Prose } from '@/components/prose';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Terms and refunds' };

export default function TermsPage() {
  return (
    <Prose>
      <h1 className="text-3xl font-bold">Terms and refunds</h1>
      <Alert tone="warning">Draft for legal review. [VERIFY with counsel before launch]</Alert>
      <h2>The Season Pass</h2>
      <ul>
        <li>
          One payment. It lasts until 7 days after the UTME date of the exam year on your account.
        </li>
        <li>
          It belongs to your phone number, not your device. You can use it on up to 2 devices at a
          time.
        </li>
        <li>Discount codes can’t be combined.</li>
      </ul>
      <h2>Refunds</h2>
      <ul>
        <li>Charged twice, or charged in error: full refund of the extra payment.</li>
        <li>
          Something we promised doesn’t work and we can’t fix it: we’ll make it right, including a
          refund where fair.
        </li>
        <li>
          Refunds go back through Paystack to the original payment method. We aim to process them
          within 5 business days.
        </li>
      </ul>
      <h2>Support promise</h2>
      <p>
        We reply to support messages within 12 hours (8am–9pm). If we miss that, we add 30 days to
        your plan.
      </p>
      <h2>Predicted scores</h2>
      <p>
        Predicted scores are estimates from your practice answers, shown as a range. They are not a
        promise of your real JAMB score or of admission. We are not affiliated with JAMB.
      </p>
    </Prose>
  );
}
