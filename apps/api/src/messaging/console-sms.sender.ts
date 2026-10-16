import { Logger } from '@nestjs/common';
import { SmsMessage, SmsSendResult, SmsSender } from './sms';

/** Development only: prints the SMS to the log. Refused in staging/production by loadEnv. */
export class ConsoleSmsSender implements SmsSender {
  readonly name = 'console';
  private readonly logger = new Logger('ConsoleSms');

  async send(message: SmsMessage): Promise<SmsSendResult> {
    this.logger.warn(`SMS to ${message.to}: ${message.body}`);
    return {};
  }
}
