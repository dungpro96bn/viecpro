import { ADMIN_PERMISSIONS, PASSWORD_RULES } from '@viecpro/shared';
import { assertCanGrant, assertCanManageAccount, assertNotSelf, normalizePermissions, temporaryPassword } from './admin-policy.js';

const superAdmin = { id: 'a1', roleKey: 'super_admin', permissions: [...ADMIN_PERMISSIONS] };
const manager = { id: 'a2', roleKey: 'hr_lead', permissions: ['admins.manage', 'users.read', 'jobs.read'] as typeof ADMIN_PERMISSIONS[number][] };
const forbidden = { response: expect.objectContaining({ code: 'FORBIDDEN' }) };

describe('admin-policy', () => {
  it('không cho tự thao tác lên chính mình', () => {
    expect(() => assertNotSelf(manager, 'a2')).toThrow();
    expect(() => assertNotSelf(manager, 'a3')).not.toThrow();
  });

  it('chỉ super_admin thao tác lên tài khoản super_admin', () => {
    expect(() => assertCanManageAccount(manager, 'super_admin')).toThrow(expect.objectContaining(forbidden));
    expect(() => assertCanManageAccount(superAdmin, 'super_admin')).not.toThrow();
    expect(() => assertCanManageAccount(manager, 'moderator')).not.toThrow();
  });

  it('chỉ super_admin gán được vai trò super_admin', () => {
    expect(() => assertCanGrant(manager, { key: 'super_admin', permissions: ['users.read'] })).toThrow(expect.objectContaining(forbidden));
    expect(() => assertCanGrant(superAdmin, { key: 'super_admin', permissions: [...ADMIN_PERMISSIONS] })).not.toThrow();
  });

  it('chặn leo thang quyền: chỉ cấp quyền mình đang có', () => {
    expect(() => assertCanGrant(manager, { key: 'support', permissions: ['users.read', 'jobs.read'] })).not.toThrow();
    expect(() => assertCanGrant(manager, { key: 'support', permissions: ['users.read', 'users.pii'] })).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'FORBIDDEN', fields: { permissions: 'users.pii' } }) }),
    );
    expect(() => assertCanGrant(superAdmin, { key: 'x', permissions: ['data.export'] })).not.toThrow();
  });

  it('chuẩn hoá danh sách quyền: bỏ quyền lạ, bỏ trùng, đúng thứ tự', () => {
    expect(normalizePermissions(['jobs.read', 'hack.all', 'dashboard.read', 'jobs.read'])).toEqual(['dashboard.read', 'jobs.read']);
  });

  it('mật khẩu tạm đủ quy tắc và không lặp lại', () => {
    const many = Array.from({ length: 50 }, () => temporaryPassword());
    for (const p of many) {
      expect(p).toHaveLength(16);
      expect(PASSWORD_RULES.every((r) => r.test(p))).toBe(true);
      expect(p).not.toMatch(/[0O1lI]/);
    }
    expect(new Set(many).size).toBe(many.length);
  });
});
