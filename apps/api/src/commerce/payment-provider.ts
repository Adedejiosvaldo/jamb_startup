import { createHmac, timingSafeEqual } from 'node:crypto';

export interface InitializeInput {
  reference: string;
  amountKobo: number;
  email: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface VerifyResult {
  status: 'success' | 'failed' | 'abandoned' | 'pending' | 'unknown';
  amountKobo: number;
  currency: string;
  paidAt: Date | null;
}

export interface PaymentProvider {
  readonly name: string;
  initialize(input: InitializeInput): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<VerifyResult>;
  refund(reference: string, amountKobo: number): Promise<{ refundId: string }>;
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

function hmac512Equal(secret: string, rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Paystack (card, bank transfer, USSD). Activation only ever follows a
 * server-side `transaction/verify` (F-BILL-04). [VERIFY] current fees/limits.
 */
export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack';

  constructor(
    private readonly secretKey: string,
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.secretKey}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: T;
    };
    if (!res.ok || !body.status || !body.data) {
      throw new Error(`Paystack ${path} failed: HTTP ${res.status} ${body.message ?? ''}`.trim());
    }
    return body.data;
  }

  async initialize(input: InitializeInput) {
    const data = await this.call<{ authorization_url: string }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: 'NGN',
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
        channels: ['card', 'bank', 'ussd', 'bank_transfer'],
      }),
    });
    return { authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const data = await this.call<{
      status: string;
      amount: number;
      currency: string;
      paid_at: string | null;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    const known = ['success', 'failed', 'abandoned', 'pending'] as const;
    return {
      status: (known as readonly string[]).includes(data.status)
        ? (data.status as VerifyResult['status'])
        : 'unknown',
      amountKobo: data.amount,
      currency: data.currency,
      paidAt: data.paid_at ? new Date(data.paid_at) : null,
    };
  }

  async refund(reference: string, amountKobo: number) {
    const data = await this.call<{ id: number | string }>('/refund', {
      method: 'POST',
      body: JSON.stringify({ transaction: reference, amount: amountKobo }),
    });
    return { refundId: String(data.id) };
  }

  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    return hmac512Equal(this.secretKey, rawBody, signature);
  }
}

/** Local/dev provider: payments succeed when a developer clicks "simulate" (or a test calls markPaid). */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  static readonly SECRET = 'fake-paystack-secret';
  private readonly paid = new Map<string, number>();
  private readonly amounts = new Map<string, number>();

  constructor(private readonly webUrl: string) {}

  async initialize(input: InitializeInput) {
    this.amounts.set(input.reference, input.amountKobo);
    return {
      authorizationUrl: `${this.webUrl}/dev/checkout/${encodeURIComponent(input.reference)}`,
    };
  }

  markPaid(reference: string, amountKobo?: number) {
    this.paid.set(reference, amountKobo ?? this.amounts.get(reference) ?? 0);
  }

  async verify(reference: string): Promise<VerifyResult> {
    const amount = this.paid.get(reference);
    return amount === undefined
      ? { status: 'pending', amountKobo: 0, currency: 'NGN', paidAt: null }
      : { status: 'success', amountKobo: amount, currency: 'NGN', paidAt: new Date() };
  }

  async refund(reference: string) {
    return { refundId: `fake-refund-${reference}` };
  }

  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    return hmac512Equal(FakePaymentProvider.SECRET, rawBody, signature);
  }
}
