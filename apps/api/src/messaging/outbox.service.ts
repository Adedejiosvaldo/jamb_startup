import { Inject, Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../common/phone';
import { SMS_SENDER, SmsSender } from './sms';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Manual-first messaging (spec principle 6). WhatsApp messages are queued in
 * message_log with their text; staff send them from the admin outbox with a
 * wa.me click until the WhatsApp Cloud API templates are approved (P1).
 * SMS (receipts) goes out immediately through the SMS provider.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async queueWhatsApp(phone: string, template: string, text: string, userId?: string | null) {
    return this.prisma.messageLog.create({
      data: {
        phone,
        userId: userId ?? null,
        channel: 'whatsapp',
        template,
        payload: { text },
        status: 'queued',
      },
    });
  }

  async sendSms(
    phone: string,
    template: string,
    text: string,
    userId?: string | null,
  ): Promise<void> {
    try {
      const res = await this.sms.send({ to: phone, body: text });
      await this.prisma.messageLog.create({
        data: {
          phone,
          userId: userId ?? null,
          channel: 'sms',
          template,
          payload: { text },
          status: 'sent',
          providerId: res.providerId,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      // Receipts are best-effort; a failed SMS must never fail a payment.
      this.logger.error(`SMS ${template} to ${maskPhone(phone)} failed: ${(err as Error).message}`);
      await this.prisma.messageLog.create({
        data: {
          phone,
          userId: userId ?? null,
          channel: 'sms',
          template,
          payload: { text },
          status: 'failed',
        },
      });
    }
  }
}

/** wa.me deep link with prefilled text. `phone` in E.164. */
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`;
}
