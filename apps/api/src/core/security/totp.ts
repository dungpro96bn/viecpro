import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) cho 2FA admin – tương thích Google Authenticator, Authy, 1Password…
 * HMAC-SHA1, 6 chữ số, bước 30 giây, chấp nhận lệch ±1 bước.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Khoá base32 không hợp lệ');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Khoá bí mật mới (20 byte = 160 bit, khuyến nghị của RFC 4226) */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Mã HOTP cho một bộ đếm (RFC 4226) */
export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(code).padStart(DIGITS, '0');
}

export function totp(secretBase32: string, at = Date.now()): string {
  return hotp(base32Decode(secretBase32), Math.floor(at / 1000 / STEP_SECONDS));
}

/** Kiểm tra mã, cho phép lệch đồng hồ ±1 bước (±30 giây) */
export function verifyTotp(secretBase32: string, code: string, at = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  const given = Buffer.from(code);
  return [-1, 0, 1].some((d) => {
    const expected = Buffer.from(hotp(secret, counter + d));
    return timingSafeEqual(expected, given);
  });
}

/** Link otpauth:// để tạo mã QR trong ứng dụng xác thực */
export function otpauthUrl(secretBase32: string, account: string, issuer = 'viecpro Admin'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
