import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, FakeSms, resetDb } from './helpers';

const PHONE_LOCAL = '0803 123 4567';
const PHONE = '+2348031234567';
const device = (n: number) => ({
  fingerprint: `device-fingerprint-${n}`.padEnd(20, 'x'),
  label: `Phone ${n}`,
});

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let sms: FakeSms;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, sms, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    sms.sent = [];
    sms.fail = false;
  });

  /** Requests a code, backdating earlier requests so the 60s cooldown never blocks a test. */
  async function requestCode(phone = PHONE_LOCAL): Promise<string> {
    await prisma.otpRequest.updateMany({ data: { createdAt: new Date(Date.now() - 61_000) } });
    await http().post('/v1/auth/otp/request').send({ phone }).expect(200);
    return sms.lastCodeFor(PHONE);
  }

  async function signIn(n: number) {
    const code = await requestCode();
    return http()
      .post('/v1/auth/otp/verify')
      .send({ phone: PHONE_LOCAL, code, device: device(n) });
  }

  it('health check reports db up', async () => {
    await http().get('/health').expect(200, { status: 'ok', db: 'up', version: 'dev' });
  });

  it('rejects invalid phone numbers', async () => {
    const res = await http().post('/v1/auth/otp/request').send({ phone: '0601234567' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('signs up a new user end to end and stores only a hash of the code', async () => {
    const code = await requestCode();
    const stored = await prisma.otpRequest.findFirstOrThrow({ where: { phone: PHONE } });
    expect(stored.codeHash).not.toContain(code);

    const log = await prisma.messageLog.findFirstOrThrow({ where: { phone: PHONE } });
    expect(JSON.stringify(log.payload)).not.toContain(code);

    const res = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone: PHONE_LOCAL, code, device: device(1) })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'signed_in',
      isNewUser: true,
      user: { phone: PHONE, role: 'student' },
    });

    const me = await http()
      .get('/v1/me')
      .set('authorization', `Bearer ${res.body.tokens.accessToken}`)
      .expect(200);
    expect(me.body.phone).toBe(PHONE);
  });

  it('a code can only be used once', async () => {
    const code = await requestCode();
    await http()
      .post('/v1/auth/otp/verify')
      .send({ phone: PHONE, code, device: device(1) })
      .expect(200);
    const res = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone: PHONE, code, device: device(1) })
      .expect(400);
    expect(res.body.code).toBe('OTP_INVALID');
  });

  it('enforces the 60s resend cooldown', async () => {
    await http().post('/v1/auth/otp/request').send({ phone: PHONE }).expect(200);
    const res = await http().post('/v1/auth/otp/request').send({ phone: PHONE }).expect(429);
    expect(res.body.code).toBe('OTP_COOLDOWN');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows at most 5 codes per hour per number', async () => {
    for (let i = 0; i < 5; i++) await requestCode();
    await prisma.otpRequest.updateMany({ data: { createdAt: new Date(Date.now() - 61_000) } });
    const res = await http().post('/v1/auth/otp/request').send({ phone: PHONE }).expect(429);
    expect(res.body.code).toBe('OTP_HOURLY_LIMIT');
  });

  it('only the newest code is valid', async () => {
    const first = await requestCode();
    const second = await requestCode();
    if (first !== second) {
      await http()
        .post('/v1/auth/otp/verify')
        .send({ phone: PHONE, code: first, device: device(1) })
        .expect(400);
    }
    await http()
      .post('/v1/auth/otp/verify')
      .send({ phone: PHONE, code: second, device: device(1) })
      .expect(200);
  });

  it('locks the code after 5 wrong attempts', async () => {
    const code = await requestCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/v1/auth/otp/verify')
        .send({ phone: PHONE, code: wrong, device: device(1) })
        .expect(400);
    }
    const res = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone: PHONE, code, device: device(1) })
      .expect(429);
    expect(res.body.code).toBe('OTP_LOCKED');
  });

  it('expired codes are rejected', async () => {
    const code = await requestCode();
    await prisma.otpRequest.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await http()
      .post('/v1/auth/otp/verify')
      .send({ phone: PHONE, code, device: device(1) })
      .expect(400);
  });

  it('returns 502 and logs failure when the SMS provider is down', async () => {
    sms.fail = true;
    const res = await http().post('/v1/auth/otp/request').send({ phone: PHONE }).expect(502);
    expect(res.body.code).toBe('OTP_SEND_FAILED');
    const log = await prisma.messageLog.findFirstOrThrow({ where: { phone: PHONE } });
    expect(log.status).toBe('failed');
  });

  it('signing in again on the same device reuses it', async () => {
    await signIn(1).then((r) => expect(r.status).toBe(200));
    const again = await signIn(1);
    expect(again.status).toBe(200);
    expect(again.body.isNewUser).toBe(false);
    expect(await prisma.device.count()).toBe(1);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const { body } = await signIn(1);
    const first = body.tokens.refreshToken;

    const rotated = await http().post('/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    const second = rotated.body.refreshToken;
    expect(second).not.toBe(first);
    await http()
      .get('/v1/me')
      .set('authorization', `Bearer ${rotated.body.accessToken}`)
      .expect(200);

    // Replaying the old token kills the whole family, including the new token.
    await http().post('/v1/auth/refresh').send({ refreshToken: first }).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: second }).expect(401);
  });

  it('limits accounts to 2 active devices and lets the user pick one to remove', async () => {
    const a = await signIn(1);
    await signIn(2).then((r) => expect(r.status).toBe(200));

    const third = await signIn(3);
    expect(third.status).toBe(409);
    expect(third.body.status).toBe('device_limit');
    expect(third.body.devices).toHaveLength(2);

    const deviceA = third.body.devices.find((d: { label: string }) => d.label === 'Phone 1');
    const replaced = await http()
      .post('/v1/auth/devices/replace')
      .send({ pendingToken: third.body.pendingToken, revokeDeviceId: deviceA.id })
      .expect(200);
    expect(replaced.body.status).toBe('signed_in');

    // Device 1 is out immediately: access token rejected and refresh fails.
    await http()
      .get('/v1/me')
      .set('authorization', `Bearer ${a.body.tokens.accessToken}`)
      .expect(401);
    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: a.body.tokens.refreshToken })
      .expect(401);

    const list = await http()
      .get('/v1/me/devices')
      .set('authorization', `Bearer ${replaced.body.tokens.accessToken}`)
      .expect(200);
    expect(list.body.devices.map((d: { label: string }) => d.label).sort()).toEqual([
      'Phone 2',
      'Phone 3',
    ]);
  });

  it('users can remove their own other device but not someone else’s', async () => {
    const a = await signIn(1);
    const b = await signIn(2);
    const auth = { authorization: `Bearer ${a.body.tokens.accessToken}` };

    const list = await http().get('/v1/me/devices').set(auth).expect(200);
    const other = list.body.devices.find((d: { current: boolean }) => !d.current);
    await http().delete(`/v1/me/devices/${other.id}`).set(auth).expect(204);
    await http()
      .get('/v1/me')
      .set('authorization', `Bearer ${b.body.tokens.accessToken}`)
      .expect(401);

    const stranger = await prisma.user.create({ data: { phone: '+2349012345678' } });
    const strangerDevice = await prisma.device.create({
      data: { userId: stranger.id, deviceFingerprint: 'stranger-device-0001' },
    });
    await http().delete(`/v1/me/devices/${strangerDevice.id}`).set(auth).expect(404);
  });

  it('logout revokes the current device', async () => {
    const { body } = await signIn(1);
    const auth = { authorization: `Bearer ${body.tokens.accessToken}` };
    await http().post('/v1/auth/logout').set(auth).expect(204);
    await http().get('/v1/me').set(auth).expect(401);
    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: body.tokens.refreshToken })
      .expect(401);
  });

  it('rejects missing and forged access tokens', async () => {
    await http().get('/v1/me').expect(401);
    await http().get('/v1/me').set('authorization', 'Bearer not-a-jwt').expect(401);
  });

  it('suspended users cannot sign in', async () => {
    await prisma.user.create({ data: { phone: PHONE, status: 'suspended' } });
    const res = await signIn(1);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_INACTIVE');
  });
});
