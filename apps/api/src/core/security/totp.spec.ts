import { base32Decode, base32Encode, hotp, totp, verifyTotp } from './totp.js';

// Vector kiểm thử chính thức RFC 4226 (phụ lục D) và RFC 6238 (phụ lục B, SHA1)
const RFC_SECRET = Buffer.from('12345678901234567890');

describe('TOTP', () => {
  it('base32 mã hoá / giải mã 2 chiều', () => {
    const enc = base32Encode(RFC_SECRET);
    expect(enc).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(enc).equals(RFC_SECRET)).toBe(true);
  });

  it('HOTP khớp RFC 4226', () => {
    expect([0, 1, 2, 9].map((c) => hotp(RFC_SECRET, c))).toEqual(['755224', '287082', '359152', '520489']);
  });

  it('TOTP khớp RFC 6238 (6 chữ số cuối)', () => {
    const secret = base32Encode(RFC_SECRET);
    expect(totp(secret, 59_000)).toBe('287082');
    expect(totp(secret, 1_111_111_109_000)).toBe('081804');
    expect(totp(secret, 1_234_567_890_000)).toBe('005924');
  });

  it('chấp nhận lệch ±30 giây, từ chối mã cũ hơn', () => {
    const secret = base32Encode(RFC_SECRET);
    const now = 1_234_567_890_000;
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, 'abc123', now)).toBe(false);
  });
});
