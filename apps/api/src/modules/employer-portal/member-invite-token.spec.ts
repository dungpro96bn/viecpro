import { hashInviteToken, inviteLink, isInviteTokenShape, newInviteToken } from './member-invite-token.js';

describe('token lời mời thành viên', () => {
  it('token ngẫu nhiên 43 ký tự, DB chỉ lưu SHA-256, hạn 7 ngày', () => {
    const now = Date.UTC(2026, 9, 2);
    const a = newInviteToken(now);
    const b = newInviteToken(now);
    expect(isInviteTokenShape(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashInviteToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
    expect(a.expiresAt.getTime() - now).toBe(7 * 86400_000);
  });

  it('chặn sớm chuỗi không đúng dạng token', () => {
    expect(isInviteTokenShape('abc')).toBe(false);
    expect(isInviteTokenShape(`${'a'.repeat(42)}/`)).toBe(false);
  });

  it('link mời trỏ tới trang web, bỏ dấu / thừa', () => {
    expect(inviteLink('https://viecpro.vn/', 'T')).toBe('https://viecpro.vn/moi-thanh-vien/T');
  });
});
