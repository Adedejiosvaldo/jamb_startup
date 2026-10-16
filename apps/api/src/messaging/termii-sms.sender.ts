import { SmsMessage, SmsSendResult, SmsSender } from './sms';

export interface TermiiConfig {
  apiKey: string;
  senderId: string;
  baseUrl: string;
}

/**
 * Termii SMS via the DND route so OTPs reach numbers on Do-Not-Disturb.
 * [VERIFY] endpoint/body against current Termii docs, that the sender ID is
 * approved, and delivery on MTN, Airtel, Glo and 9mobile before launch.
 */
export class TermiiSmsSender implements SmsSender {
  readonly name = 'termii';

  constructor(
    private readonly config: TermiiConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const res = await this.fetchImpl(`${this.config.baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: this.config.apiKey,
        to: message.to.replace(/^\+/, ''),
        from: this.config.senderId,
        sms: message.body,
        type: 'plain',
        channel: 'dnd',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Termii send failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { message_id?: string };
    return { providerId: data.message_id };
  }
}
