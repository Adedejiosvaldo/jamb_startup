'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Choice, ChoiceGroup } from '@/components/ui/choice';
import { TextareaField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api, errorMessage } from '@/lib/api';
import { supportWaLink } from '@/lib/config';

const CATEGORIES = [
  ['payment', 'I paid but my plan isn’t active'],
  ['otp', 'I didn’t get my code'],
  ['access', 'I can’t sign in or open something'],
  ['content', 'A question or answer is wrong'],
  ['refund', 'I want a refund'],
  ['other', 'Something else'],
] as const;

/** F-SUP-02: report a problem with context attached automatically. */
export default function SupportPage() {
  const pathname = usePathname();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>('payment');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const help = supportWaLink();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('/v1/support/tickets', {
        method: 'POST',
        body: {
          category,
          body,
          context: {
            lastScreen: document.referrer || pathname,
            appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
            screen: `${window.screen.width}x${window.screen.height}`,
            online: navigator.onLine,
          },
        },
      });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report a problem"
        description="We reply within 12 hours, 8am–9pm. Payment problems come first."
      />
      {done ? (
        <Alert tone="success" title="We’ve got it">
          We’ll reply by WhatsApp or SMS to your phone number. If it’s a payment issue, keep your
          bank alert or Paystack email handy.
        </Alert>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <ChoiceGroup legend="What’s the problem?">
            {CATEGORIES.map(([v, label]) => (
              <Choice
                key={v}
                name="category"
                checked={category === v}
                onChange={() => setCategory(v)}
                title={label}
              />
            ))}
          </ChoiceGroup>
          <TextareaField
            label="Tell us what happened"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            minLength={3}
            maxLength={4000}
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" block loading={busy} disabled={body.trim().length < 3}>
            Send
          </Button>
        </form>
      )}
      {help && (
        <a
          href={help}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-teal-700"
        >
          <MessageCircle aria-hidden="true" className="size-4" /> Or chat with us on WhatsApp
        </a>
      )}
    </div>
  );
}
