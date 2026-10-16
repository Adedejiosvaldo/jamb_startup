import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** Public web app origin, used in links we send (pay links, parent reports). */
  WEB_URL: z.string().url().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  OTP_HASH_SECRET: z.string().min(32, 'OTP_HASH_SECRET must be at least 32 chars'),
  SMS_PROVIDER: z.enum(['console', 'termii']).default('console'),
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().default('ScoreCoach'),
  TERMII_BASE_URL: z.string().url().default('https://api.ng.termii.com'),
  // paystack | fake  (fake simulates payments locally; refused in staging/production)
  PAYMENT_PROVIDER: z.enum(['paystack', 'fake']).default('fake'),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_BASE_URL: z.string().url().default('https://api.paystack.co'),
  /** Paystack needs an email; we use <digits>@this-domain for phone-only payers. [DECIDE] domain. */
  PAYMENT_EMAIL_DOMAIN: z.string().default('pay.scorecoach.ng'),
  SUPPORT_WHATSAPP: z.string().default(''),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  const deployed = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
  if (deployed && env.SMS_PROVIDER === 'console') {
    throw new Error('SMS_PROVIDER=console is not allowed in staging/production');
  }
  if (deployed && env.PAYMENT_PROVIDER === 'fake') {
    throw new Error('PAYMENT_PROVIDER=fake is not allowed in staging/production');
  }
  if (env.PAYMENT_PROVIDER === 'paystack' && !env.PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is required when PAYMENT_PROVIDER=paystack');
  }
  if (env.SMS_PROVIDER === 'termii' && !env.TERMII_API_KEY) {
    throw new Error('TERMII_API_KEY is required when SMS_PROVIDER=termii');
  }
  return env;
}

export const ENV = Symbol('ENV');
