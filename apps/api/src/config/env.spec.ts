import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  OTP_HASH_SECRET: 'y'.repeat(32),
};

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.SMS_PROVIDER).toBe('console');
  });

  it('defaults WEB_URL to the Vercel domain (web and API share it)', () => {
    expect(
      loadEnv({ ...base, VERCEL_PROJECT_PRODUCTION_URL: 'scorecoach.vercel.app' }).WEB_URL,
    ).toBe('https://scorecoach.vercel.app');
    expect(
      loadEnv({ ...base, WEB_URL: 'https://scorecoach.ng', VERCEL_URL: 'x.vercel.app' }).WEB_URL,
    ).toBe('https://scorecoach.ng');
  });

  it('rejects short secrets', () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('refuses the console SMS provider in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/console/);
  });

  it('lets staging use test providers (Vercel sets NODE_ENV=production)', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      DEV_FIXED_OTP: '123456',
    });
    expect(env.APP_ENV).toBe('staging');
    expect(env.PAYMENT_PROVIDER).toBe('fake');
  });

  it('refuses a fixed OTP in production', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        SMS_PROVIDER: 'termii',
        TERMII_API_KEY: 'k',
        PAYMENT_PROVIDER: 'paystack',
        PAYSTACK_SECRET_KEY: 's',
        DEV_FIXED_OTP: '123456',
      }),
    ).toThrow(/DEV_FIXED_OTP/);
  });

  it('refuses the fake payment provider in production', () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', SMS_PROVIDER: 'termii', TERMII_API_KEY: 'k' }),
    ).toThrow(/PAYMENT_PROVIDER=fake/);
  });

  it('requires a Termii key when Termii is selected', () => {
    expect(() => loadEnv({ ...base, SMS_PROVIDER: 'termii' })).toThrow(/TERMII_API_KEY/);
  });
});
