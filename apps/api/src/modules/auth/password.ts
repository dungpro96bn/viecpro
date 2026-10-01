import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LEN = 64;
const COST = 16384;

function scryptAsync(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, KEY_LEN, options, (err, key) => (err ? reject(err) : resolve(key))));
}

/** Băm mật khẩu bằng scrypt (có sẵn trong Node, không cần thư viện native). Định dạng: scrypt$N$salt$hash */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, { N: COST });
  return `scrypt$${COST}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), { N: Number(n) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
