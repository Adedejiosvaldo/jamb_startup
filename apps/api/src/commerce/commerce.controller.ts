import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { z } from 'zod';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { Staff } from '../auth/staff.guard';
import { AuditService } from '../common/audit.service';
import { normaliseNigerianPhone } from '../common/phone';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { ZodQueryPipe } from '../common/zod-query.pipe';
import { ENV, Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceService } from './commerce.service';
import { FakePaymentProvider, PAYMENT_PROVIDER, PaymentProvider } from './payment-provider';

const checkoutSchema = z.object({
  productCode: z.string().default('SEASON_PASS'),
  couponCode: z.string().max(40).optional(),
});
const phoneSchema = z.object({
  payerPhone: z.string().transform((v, ctx) => {
    const n = normaliseNigerianPhone(v);
    if (!n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid Nigerian mobile number.',
      });
      return z.NEVER;
    }
    return n;
  }),
});

@Controller('v1')
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('products')
  products() {
    return this.commerce.products();
  }

  @Get('quote')
  quote(@Query('product') product = 'SEASON_PASS', @Query('coupon') coupon?: string) {
    return this.commerce.quote(product, coupon || undefined);
  }

  @Post('checkout')
  @UseGuards(AuthGuard)
  checkout(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>,
  ) {
    return this.commerce.checkout(req.auth.userId, body.productCode, body.couponCode);
  }

  @Get('checkout/verify')
  @UseGuards(AuthGuard)
  verify(@Req() req: AuthedRequest, @Query('reference') reference: string) {
    return this.commerce.verifyForUser(req.auth.userId, reference);
  }

  @Post('pay-link')
  @UseGuards(AuthGuard)
  payLink(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>,
  ) {
    return this.commerce.createPayLink(req.auth.userId, body.productCode, body.couponCode);
  }

  @Get('pay-links/:token')
  payLinkInfo(@Param('token') token: string) {
    return this.commerce.payLink(token);
  }

  @Post('pay-links/:token/checkout')
  payLinkCheckout(
    @Param('token') token: string,
    @Body(new ZodBodyPipe(phoneSchema)) body: z.infer<typeof phoneSchema>,
  ) {
    return this.commerce.payLinkCheckout(token, body.payerPhone);
  }

  @Get('pay-links/:token/verify')
  payLinkVerify(@Param('token') token: string) {
    return this.commerce.verifyPayLink(token);
  }

  @Post('webhooks/paystack')
  @HttpCode(200)
  @SkipThrottle()
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    return this.commerce.handleWebhook(req.rawBody, signature);
  }
}

const refundSchema = z.object({
  reason: z.enum(['guarantee', 'goodwill', 'duplicate', 'error']),
  amountKobo: z.number().int().positive().optional(),
});
const grantSchema = z.object({ days: z.number().int().min(1).max(365), reason: z.string().min(3) });
const couponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(40)
    .transform((c) => c.toUpperCase()),
  percentOff: z.number().int().min(1).max(100).nullable().optional(),
  amountOffKobo: z.number().int().min(100).nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  ownerTeacherId: z.string().uuid().nullable().optional(),
});
const orderQuery = z.object({
  status: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  phone: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

@Controller('v1/admin')
@Staff('admin')
export class CommerceAdminController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('orders')
  orders(@Query(new ZodQueryPipe(orderQuery)) q: z.infer<typeof orderQuery>) {
    return this.commerce.listOrders(q);
  }

  @Post('orders/:id/reconcile')
  reconcile(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.commerce.reconcile(req.auth.userId, id);
  }

  @Post('orders/:id/refund')
  refund(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(refundSchema)) body: z.infer<typeof refundSchema>,
  ) {
    return this.commerce.refund(req.auth.userId, id, body.reason, body.amountKobo);
  }

  @Post('users/:id/grant-days')
  grant(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(grantSchema)) body: z.infer<typeof grantSchema>,
  ) {
    return this.commerce.grantDays(req.auth.userId, id, body.days, body.reason);
  }

  @Get('coupons')
  coupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { ownerTeacher: { include: { user: { select: { name: true, phone: true } } } } },
    });
  }

  @Post('coupons')
  async createCoupon(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(couponSchema)) body: z.infer<typeof couponSchema>,
  ) {
    const row = await this.prisma.coupon.create({ data: body });
    await this.audit.record(req.auth.userId, 'create', 'coupon', row.id, null, row);
    return row;
  }

  @Patch('coupons/:id')
  async updateCoupon(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(couponSchema.partial())) body: Partial<z.infer<typeof couponSchema>>,
  ) {
    const before = await this.prisma.coupon.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.coupon.update({ where: { id }, data: body });
    await this.audit.record(req.auth.userId, 'update', 'coupon', id, before, row);
    return row;
  }
}

/** Local development only: simulate Paystack completing a payment. */
@Controller('v1/dev/payments')
export class DevPaymentsController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly commerce: CommerceService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post(':reference/succeed')
  @HttpCode(200)
  async succeed(@Param('reference') reference: string) {
    if (!(this.provider instanceof FakePaymentProvider) || this.env.APP_ENV === 'production')
      throw new NotFoundException();
    this.provider.markPaid(reference);
    return { result: await this.commerce.fulfil(reference) };
  }
}
