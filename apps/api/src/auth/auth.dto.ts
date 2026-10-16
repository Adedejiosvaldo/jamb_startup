import { z } from 'zod';
import { normaliseNigerianPhone } from '../common/phone';

const phone = z.string().transform((v, ctx) => {
  const normalised = normaliseNigerianPhone(v);
  if (!normalised) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid Nigerian mobile number (070, 080, 081, 090 or 091).',
    });
    return z.NEVER;
  }
  return normalised;
});

export const otpRequestSchema = z.object({
  phone,
  // WhatsApp OTP fallback is P1 (F-ACC-01); only SMS is accepted for now.
  channel: z.literal('sms').default('sms'),
});
export type OtpRequestDto = z.infer<typeof otpRequestSchema>;

const device = z.object({
  /** Random id the client generates once and keeps in local storage. */
  fingerprint: z.string().min(16).max(128),
  userAgent: z.string().max(512).optional(),
  label: z.string().max(80).optional(),
});

export const otpVerifySchema = z.object({
  phone,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  device,
});
export type OtpVerifyDto = z.infer<typeof otpVerifySchema>;

export const replaceDeviceSchema = z.object({
  pendingToken: z.string().min(1),
  revokeDeviceId: z.string().uuid(),
});
export type ReplaceDeviceDto = z.infer<typeof replaceDeviceSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshDto = z.infer<typeof refreshSchema>;
