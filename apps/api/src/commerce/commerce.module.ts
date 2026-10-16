import { Module } from '@nestjs/common';
import { ENV, Env } from '../config/env';
import {
  CommerceAdminController,
  CommerceController,
  DevPaymentsController,
} from './commerce.controller';
import { CommerceService } from './commerce.service';
import { EntitlementsService } from './entitlements.service';
import { FakePaymentProvider, PAYMENT_PROVIDER, PaystackProvider } from './payment-provider';

@Module({
  controllers: [CommerceController, CommerceAdminController, DevPaymentsController],
  providers: [
    EntitlementsService,
    CommerceService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.PAYMENT_PROVIDER === 'paystack'
          ? new PaystackProvider(env.PAYSTACK_SECRET_KEY!, env.PAYSTACK_BASE_URL)
          : new FakePaymentProvider(env.WEB_URL),
    },
  ],
  exports: [EntitlementsService, CommerceService, PAYMENT_PROVIDER],
})
export class CommerceModule {}
