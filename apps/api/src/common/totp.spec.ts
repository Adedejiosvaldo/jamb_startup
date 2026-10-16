import { base32Decode, base32Encode, hotp, totp, verifyTotp } from './totp';

// RFC 4226 Appendix D test secret "12345678901234567890".
const RFC_SECRET = Buffer.from('12345678901234567890');

describe('totp', () => {
  it('matches RFC 4226 HOTP vectors', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314'];
    expected.forEach((code, counter) => expect(hotp(RFC_SECRET, counter)).toBe(code));
  });

  it('matches RFC 6238 TOTP vector at T=59s (8 digits truncated to 6)', () => {
    // RFC 6238 SHA-1 at 59 s is 94287082; 6-digit form is 287082.
    expect(totp(base32Encode(RFC_SECRET), 59_000)).toBe('287082');
  });

  it('round-trips base32', () => {
    const buf = Buffer.from('hello world, scorecoach');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it('accepts one step of drift and rejects garbage', () => {
    const secret = base32Encode(RFC_SECRET);
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false);
  });
});
