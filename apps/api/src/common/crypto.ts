import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Uniformly random, zero-padded numeric code. */
export function randomNumericCode(length = 6): string {
  return randomInt(0, 10 ** length)
    .toString()
    .padStart(length, '0');
}
