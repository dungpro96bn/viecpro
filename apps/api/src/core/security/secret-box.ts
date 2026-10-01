import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Mã hoá dữ liệu nhạy cảm khi lưu DB (khoá 2FA…) bằng AES-256-GCM.
 * Định dạng: v1.<iv>.<tag>.<ciphertext> (base64url). Khoá dẫn xuất từ chuỗi bí mật bằng SHA-256.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, data] = payload.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Dữ liệu mã hoá không hợp lệ');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }
}
