import { createHash, randomBytes } from 'node:crypto';

/** Link mời sống 7 ngày; DB chỉ lưu SHA-256 của token (lộ DB không dùng lại được link) */
export const INVITE_TTL_DAYS = 7;

export function newInviteToken(now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token), expiresAt: new Date(now + INVITE_TTL_DAYS * 86400_000) };
}

export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Token hợp lệ về hình thức (43 ký tự base64url) – chặn sớm chuỗi rác trước khi truy vấn */
export const isInviteTokenShape = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export const inviteLink = (webBaseUrl: string, token: string) => `${webBaseUrl.replace(/\/$/, '')}/moi-thanh-vien/${token}`;
