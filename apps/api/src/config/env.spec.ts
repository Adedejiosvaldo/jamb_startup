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

  it('rejects short secrets', () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('refuses the console SMS provider in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/console/);
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
