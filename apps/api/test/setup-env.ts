process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/scorecoach_test?schema=public';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-0000';
process.env.OTP_HASH_SECRET ??= 'test-otp-secret-test-otp-secret-test-00000';
process.env.SMS_PROVIDER = 'console';
