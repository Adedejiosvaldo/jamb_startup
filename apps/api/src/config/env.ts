import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  /**
   * Deployment tier. Hosts like Vercel force NODE_ENV=production everywhere, so
   * staging is told apart with APP_ENV. Defaults to NODE_ENV.
   * Only `production` refuses test providers (console SMS, fake payments).
   */
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).optional(),
  /** Staging/dev convenience: every OTP is this 6-digit code. Refused in production. */
  DEV_FIXED_OTP: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
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

export type Env = Omit<z.infer<typeof schema>, 'APP_ENV'> & {
  APP_ENV: NonNullable<z.infer<typeof schema>['APP_ENV']>;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  // On Vercel, web and API share one domain; default links to it when WEB_URL isn't set.
  const vercelHost = source.VERCEL_PROJECT_PRODUCTION_URL ?? source.VERCEL_URL;
  const webUrl = source.WEB_URL
    ? parsed.data.WEB_URL
    : vercelHost
      ? `https://${vercelHost}`
      : parsed.data.WEB_URL;
  const env = {
    ...parsed.data,
    WEB_URL: webUrl,
    APP_ENV: parsed.data.APP_ENV ?? parsed.data.NODE_ENV,
  };
  if (env.APP_ENV === 'production') {
    if (env.SMS_PROVIDER === 'console')
      throw new Error('SMS_PROVIDER=console is not allowed in production');
    if (env.PAYMENT_PROVIDER === 'fake')
      throw new Error('PAYMENT_PROVIDER=fake is not allowed in production');
    if (env.DEV_FIXED_OTP) throw new Error('DEV_FIXED_OTP is not allowed in production');
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
