import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Coupon, Order, Prisma, Product, RefundReason } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../auth/auth.errors';
import { AuditService } from '../common/audit.service';
import { randomToken } from '../common/crypto';
import { addDays } from '../common/time';
import { ENV, Env } from '../config/env';
import { OutboxService } from '../messaging/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from './entitlements.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider';

export const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

@Injectable()
export class CommerceService {
  private readonly logger = new Logger(CommerceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  products() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: { priceKobo: 'asc' },
      select: { code: true, name: true, priceKobo: true, entitlement: true },
    });
  }

  async quote(productCode: string, couponCode?: string) {
    const product = await this.product(productCode);
    const coupon = couponCode ? await this.validCoupon(couponCode) : null;
    return this.price(product, coupon);
  }

  /** F-BILL-01: student pays for themselves. */
  async checkout(userId: string, productCode: string, couponCode?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const order = await this.createOrder(userId, user.phone, productCode, couponCode, null);
    return this.startPayment(order, user.phone);
  }

  /** F-PAR-01: student generates a link for a parent; parent pays without an account. */
  async createPayLink(userId: string, productCode: string, couponCode?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const order = await this.createOrder(
      userId,
      user.phone,
      productCode,
      couponCode,
      randomToken(18),
    );
    const url = `${this.env.WEB_URL}/pay/${order.payLinkToken}`;
    const first = user.name?.split(' ')[0] ?? 'I';
    const text =
      `Hello! ${first === 'I' ? 'I' : `It's ${first}. I`}'m preparing for JAMB with ScoreCoach. ` +
      `The Season Pass gives me a daily study plan, weekly mocks and a weekly progress report to you. ` +
      `It costs ${naira(order.amountKobo)}. You can pay safely here (card, transfer or USSD): ${url}`;
    return {
      url,
      amountKobo: order.amountKobo,
      message: text,
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
    };
  }

  async payLink(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { payLinkToken: token },
      include: { product: true, user: true, coupon: true },
    });
    if (!order)
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'PAY_LINK_NOT_FOUND',
        'This payment link is not valid.',
      );
    return {
      studentFirstName: order.user?.name?.split(' ')[0] ?? null,
      product: { code: order.product.code, name: order.product.name },
      amountKobo: order.amountKobo,
      couponCode: order.coupon?.code ?? null,
      status: order.status,
    };
  }

  async payLinkCheckout(token: string, payerPhone: string) {
    const order = await this.prisma.order.findUnique({ where: { payLinkToken: token } });
    if (!order)
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'PAY_LINK_NOT_FOUND',
        'This payment link is not valid.',
      );
    if (order.status === 'paid')
      throw new ApiError(
        HttpStatus.CONFLICT,
        'ALREADY_PAID',
        'This has already been paid. Thank you!',
      );
    // A new reference per attempt so an abandoned Paystack session can't block a retry.
    const fresh = await this.prisma.order.update({
      where: { id: order.id },
      data: { payerPhone, paystackReference: this.newReference(), status: 'pending' },
    });
    return this.startPayment(fresh, payerPhone);
  }

  /** F-BILL-04: webhook-verified activation. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !this.provider.verifySignature(rawBody, signature)) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'BAD_SIGNATURE', 'Invalid signature.');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      data?: { reference?: string };
    };
    if (event.event === 'charge.success' && event.data?.reference) {
      await this.fulfil(event.data.reference);
    }
    return { received: true };
  }

  /** Called after the Paystack redirect; still verifies server-side before unlocking anything. */
  async verifyForUser(userId: string, reference: string) {
    const order = await this.prisma.order.findUnique({ where: { paystackReference: reference } });
    if (!order || order.userId !== userId)
      throw new ApiError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Payment not found.');
    if (order.status === 'pending') await this.fulfil(reference);
    const fresh = await this.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const ent = await this.entitlements.active(userId);
    return {
      status: fresh.status,
      plan: ent ? { productCode: ent.product.code, endsAt: ent.endsAt } : null,
    };
  }

  /** Pay-link status for the parent's thank-you page. */
  async verifyPayLink(token: string) {
    const order = await this.prisma.order.findUnique({ where: { payLinkToken: token } });
    if (!order)
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'PAY_LINK_NOT_FOUND',
        'This payment link is not valid.',
      );
    if (order.status === 'pending') await this.fulfil(order.paystackReference);
    const fresh = await this.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    return { status: fresh.status };
  }

  /**
   * Idempotent fulfilment: verify with the provider, flip pending→paid once,
   * grant the entitlement, count the coupon, record commission, send receipt.
   */
  async fulfil(reference: string): Promise<'paid' | 'pending' | 'failed' | 'ignored'> {
    const order = await this.prisma.order.findUnique({
      where: { paystackReference: reference },
      include: { product: true, user: true },
    });
    if (!order) {
      this.logger.warn(`Payment for unknown reference ${reference}`);
      return 'ignored';
    }
    if (order.status !== 'pending') return order.status === 'paid' ? 'paid' : 'ignored';

    if (order.amountKobo > 0) {
      const v = await this.provider.verify(reference);
      if (v.status === 'failed' || v.status === 'abandoned') {
        await this.prisma.order.updateMany({
          where: { id: order.id, status: 'pending' },
          data: { status: 'failed' },
        });
        return 'failed';
      }
      if (v.status !== 'success') return 'pending';
      if (v.currency !== 'NGN' || v.amountKobo < order.amountKobo) {
        this.logger.error(
          `Amount mismatch on ${reference}: got ${v.amountKobo} ${v.currency}, expected ${order.amountKobo}`,
        );
        return 'pending';
      }
    }
    if (!order.userId) return 'ignored';

    const now = new Date();
    const examYear =
      order.user?.examYear ?? now.getUTCFullYear() + (now.getUTCMonth() >= 6 ? 1 : 0);
    const endsAt = await this.entitlements.seasonEnd(examYear);

    const won = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.order.updateMany({
        where: { id: order.id, status: 'pending' },
        data: { status: 'paid', paidAt: now },
      });
      if (flipped.count !== 1) return false;
      // Extend rather than overlap if they already have time left.
      const current = await tx.entitlement.findFirst({
        where: { userId: order.userId!, revokedAt: null, endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
      });
      await tx.entitlement.create({
        data: {
          userId: order.userId!,
          productId: order.productId,
          orderId: order.id,
          startsAt: now,
          endsAt: current && current.endsAt > endsAt ? current.endsAt : endsAt,
        },
      });
      if (order.couponId)
        await tx.coupon.update({ where: { id: order.couponId }, data: { used: { increment: 1 } } });
      await this.recordCommission(tx, order);
      await tx.event.create({
        data: {
          userId: order.userId,
          name: 'payment_succeeded',
          props: {
            product: order.product.code,
            amount: order.amountKobo,
            coupon: order.couponId,
            referrer: order.referrerCode,
            payLink: !!order.payLinkToken,
          },
        },
      });
      return true;
    });
    if (!won) return 'paid';

    const studentName = order.user?.name?.split(' ')[0] ?? 'your account';
    const support = this.env.SUPPORT_WHATSAPP
      ? ` Help on WhatsApp: ${this.env.SUPPORT_WHATSAPP}.`
      : '';
    const receipt =
      `ScoreCoach: payment received — ${order.product.name} for ${studentName}, ${naira(order.amountKobo)}. ` +
      `Ref ${order.paystackReference.slice(-10)}. Active until ${endsAt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}.${support}`;
    await this.outbox.sendSms(order.payerPhone, 'payment_success', receipt, order.userId);
    return 'paid';
  }

  // ───────────────────────────── admin ─────────────────────────────

  async listOrders(filter: {
    status?: Order['status'];
    phone?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.OrderWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.phone
        ? {
            OR: [
              { payerPhone: { contains: filter.phone } },
              { user: { phone: { contains: filter.phone } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          product: true,
          user: { select: { id: true, phone: true, name: true } },
          coupon: true,
          refunds: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      pages: Math.max(1, Math.ceil(total / filter.pageSize)),
    };
  }

  /** Paid-but-not-unlocked runbook (spec §18): re-verify with Paystack and fulfil. */
  async reconcile(actorId: string, orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const result = await this.fulfil(order.paystackReference);
    await this.audit.record(
      actorId,
      'reconcile',
      'order',
      orderId,
      { status: order.status },
      { result },
    );
    return { result };
  }

  /** F-BILL-06: refunds (guarantee, goodwill, duplicate, error). */
  async refund(actorId: string, orderId: string, reason: RefundReason, amountKobo?: number) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { refunds: true },
    });
    if (order.status !== 'paid')
      throw new ApiError(HttpStatus.CONFLICT, 'NOT_PAID', 'Only paid orders can be refunded.');
    const already = order.refunds.reduce((s, r) => s + r.amountKobo, 0);
    const amount = amountKobo ?? order.amountKobo - already;
    if (amount <= 0 || already + amount > order.amountKobo) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'BAD_AMOUNT',
        'Refund amount is more than what was paid.',
      );
    }
    const { refundId } = await this.provider.refund(order.paystackReference, amount);
    const full = already + amount >= order.amountKobo;
    const now = new Date();
    const refund = await this.prisma.$transaction(async (tx) => {
      const r = await tx.refund.create({
        data: {
          orderId,
          reason,
          amountKobo: amount,
          approvedBy: actorId,
          paystackRefundId: refundId,
        },
      });
      if (full) {
        await tx.order.update({ where: { id: orderId }, data: { status: 'refunded' } });
        await tx.entitlement.updateMany({
          where: { orderId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.commission.updateMany({
          where: { orderId, status: { not: 'reversed' } },
          data: { status: 'reversed' },
        });
      }
      return r;
    });
    await this.audit.record(
      actorId,
      'refund',
      'order',
      orderId,
      { status: order.status },
      { refund, full },
    );
    return refund;
  }

  /** Goodwill days (support, service guarantee: reply late ⇒ 30 days free). */
  async grantDays(actorId: string, userId: string, days: number, reason: string) {
    const now = new Date();
    const current = await this.prisma.entitlement.findFirst({
      where: { userId, revokedAt: null, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });
    let row;
    if (current) {
      row = await this.prisma.entitlement.update({
        where: { id: current.id },
        data: { endsAt: addDays(current.endsAt, days) },
      });
    } else {
      const product = await this.prisma.product.findFirstOrThrow({
        where: { code: 'SEASON_PASS' },
      });
      row = await this.prisma.entitlement.create({
        data: { userId, productId: product.id, startsAt: now, endsAt: addDays(now, days) },
      });
    }
    await this.audit.record(actorId, 'grant_days', 'entitlement', row.id, current, {
      ...row,
      days,
      reason,
    });
    return row;
  }

  // ───────────────────────────── internals ─────────────────────────────

  private async createOrder(
    userId: string,
    payerPhone: string,
    productCode: string,
    couponCode: string | undefined,
    payLinkToken: string | null,
  ) {
    const product = await this.product(productCode);
    const coupon = couponCode ? await this.validCoupon(couponCode) : null;
    const { amountKobo } = this.price(product, coupon);
    // Referral attribution: a student in a teacher's class is credited to that teacher.
    const membership = await this.prisma.classMember.findFirst({
      where: { studentId: userId, class: { teacher: { verifiedAt: { not: null } } } },
      include: { class: { include: { teacher: true } } },
      orderBy: { joinedAt: 'desc' },
    });
    return this.prisma.order.create({
      data: {
        userId,
        payerPhone,
        productId: product.id,
        amountKobo,
        couponId: coupon?.id,
        referrerCode: membership?.class.teacher?.referralCode ?? null,
        paystackReference: this.newReference(),
        payLinkToken,
      },
    });
  }

  private async startPayment(order: Order, payerPhone: string) {
    if (order.amountKobo === 0) {
      await this.fulfil(order.paystackReference);
      return {
        reference: order.paystackReference,
        authorizationUrl: null,
        status: 'paid' as const,
      };
    }
    const callbackUrl = order.payLinkToken
      ? `${this.env.WEB_URL}/pay/${order.payLinkToken}/done`
      : `${this.env.WEB_URL}/checkout/done?reference=${encodeURIComponent(order.paystackReference)}`;
    try {
      const { authorizationUrl } = await this.provider.initialize({
        reference: order.paystackReference,
        amountKobo: order.amountKobo,
        email: `${payerPhone.replace(/\D/g, '')}@${this.env.PAYMENT_EMAIL_DOMAIN}`,
        callbackUrl,
        metadata: { orderId: order.id, payLink: !!order.payLinkToken },
      });
      await this.prisma.event.create({
        data: { userId: order.userId, name: 'checkout_started', props: { orderId: order.id } },
      });
      return { reference: order.paystackReference, authorizationUrl, status: 'pending' as const };
    } catch (err) {
      this.logger.error(`Payment init failed for ${order.id}: ${(err as Error).message}`);
      throw new ApiError(
        HttpStatus.BAD_GATEWAY,
        'PAYMENT_INIT_FAILED',
        'We could not start the payment. Please try again.',
      );
    }
  }

  private async recordCommission(tx: Prisma.TransactionClient, order: Order) {
    let teacher = null;
    if (order.couponId) {
      const c = await tx.coupon.findUnique({
        where: { id: order.couponId },
        include: { ownerTeacher: true },
      });
      teacher = c?.ownerTeacher ?? null;
    }
    if (!teacher && order.referrerCode)
      teacher = await tx.teacher.findUnique({ where: { referralCode: order.referrerCode } });
    if (!teacher?.verifiedAt || teacher.userId === order.userId) return; // no self-referral
    const amountKobo = Math.round((order.amountKobo * Number(teacher.commissionPct)) / 100);
    if (amountKobo > 0)
      await tx.commission.create({
        data: { teacherId: teacher.userId, orderId: order.id, amountKobo },
      });
  }

  private async product(code: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { code } });
    if (!product || !product.active)
      throw new ApiError(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', 'That plan is not available.');
    return product;
  }

  private async validCoupon(code: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    const now = new Date();
    if (
      !coupon ||
      (coupon.expiresAt && coupon.expiresAt <= now) ||
      (coupon.maxUses !== null && coupon.used >= coupon.maxUses)
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'COUPON_INVALID',
        'That code is not valid or has expired.',
      );
    }
    return coupon;
  }

  /** Coupons don't stack (spec §22): one coupon per order. */
  private price(product: Product, coupon: Coupon | null) {
    let discount = 0;
    if (coupon?.percentOff) discount = Math.round((product.priceKobo * coupon.percentOff) / 100);
    else if (coupon?.amountOffKobo) discount = coupon.amountOffKobo;
    discount = Math.min(discount, product.priceKobo);
    return {
      product: { code: product.code, name: product.name, priceKobo: product.priceKobo },
      coupon: coupon && {
        code: coupon.code,
        percentOff: coupon.percentOff,
        amountOffKobo: coupon.amountOffKobo,
      },
      discountKobo: discount,
      amountKobo: product.priceKobo - discount,
    };
  }

  private newReference(): string {
    return `sc_${randomUUID().replace(/-/g, '')}`;
  }
}
