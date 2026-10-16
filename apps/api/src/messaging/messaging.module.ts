import { Global, Module } from '@nestjs/common';
import { ENV, Env } from '../config/env';
import { ConsoleSmsSender } from './console-sms.sender';
import { OutboxService } from './outbox.service';
import { SMS_SENDER } from './sms';
import { TermiiSmsSender } from './termii-sms.sender';

@Global()
@Module({
  providers: [
    {
      provide: SMS_SENDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.SMS_PROVIDER === 'termii'
          ? new TermiiSmsSender({
              apiKey: env.TERMII_API_KEY!,
              senderId: env.TERMII_SENDER_ID,
              baseUrl: env.TERMII_BASE_URL,
            })
          : new ConsoleSmsSender(),
    },
    OutboxService,
  ],
  exports: [SMS_SENDER, OutboxService],
})
export class MessagingModule {}
