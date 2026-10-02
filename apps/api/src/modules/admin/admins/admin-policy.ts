import { HttpStatus } from '@nestjs/common';
import { ADMIN_PERMISSIONS, type AdminPermission, PASSWORD_RULES, SUPER_ADMIN_ROLE } from '@viecpro/shared';
import { randomInt } from 'node:crypto';
import { ApiException } from '../../../core/http/api-exception.js';
import type { AdminContext } from '../admin-access.js';

/**
 * Luật bảo vệ phân quyền quản trị (RULE-BE.md mục 7) – hàm thuần để test riêng:
 * - không tự đổi vai trò / tự khoá / tự đặt lại 2FA
 * - chỉ super_admin gán được vai trò super_admin hoặc thao tác lên tài khoản super_admin
 * - admin khác super_admin chỉ cấp được những quyền chính mình đang có (chống leo thang quyền)
 */
export const isSuperAdmin = (actor: Pick<AdminContext, 'roleKey'>) => actor.roleKey === SUPER_ADMIN_ROLE;

export function assertNotSelf(actor: Pick<AdminContext, 'id'>, targetId: string, message = 'Không thể tự thay đổi tài khoản của chính mình') {
  if (actor.id === targetId) throw new ApiException('FORBIDDEN', message, HttpStatus.FORBIDDEN);
}

/** Thao tác lên tài khoản đang giữ vai trò super_admin cần người thao tác cũng là super_admin */
export function assertCanManageAccount(actor: Pick<AdminContext, 'roleKey'>, targetRoleKey: string) {
  if (targetRoleKey === SUPER_ADMIN_ROLE && !isSuperAdmin(actor)) {
    throw new ApiException('FORBIDDEN', 'Chỉ Super Admin được thay đổi tài khoản Super Admin', HttpStatus.FORBIDDEN);
  }
}

/** Gán / sửa / xoá một vai trò có các quyền này */
export function assertCanGrant(actor: Pick<AdminContext, 'roleKey' | 'permissions'>, role: { key: string; permissions: readonly string[] }) {
  if (isSuperAdmin(actor)) return;
  if (role.key === SUPER_ADMIN_ROLE) throw new ApiException('FORBIDDEN', 'Chỉ Super Admin được gán vai trò Super Admin', HttpStatus.FORBIDDEN);
  const missing = role.permissions.filter((p) => !actor.permissions.includes(p as AdminPermission));
  if (missing.length) {
    throw new ApiException('FORBIDDEN', 'Không thể cấp quyền mà bạn không có', HttpStatus.FORBIDDEN, { permissions: missing.join(', ') });
  }
}

/** Chỉ giữ quyền hợp lệ, đúng thứ tự khai báo, không trùng */
export const normalizePermissions = (permissions: readonly string[]): AdminPermission[] => ADMIN_PERMISSIONS.filter((p) => permissions.includes(p));

const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const pick = (chars: string) => chars[randomInt(chars.length)]!;

/** Mật khẩu tạm 16 ký tự, đủ PASSWORD_RULES, bỏ ký tự dễ nhầm (0/O, 1/l/I) */
export function temporaryPassword(length = 16): string {
  const all = LOWER + UPPER + DIGITS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), ...Array.from({ length: length - 3 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  const password = chars.join('');
  return PASSWORD_RULES.every((r) => r.test(password)) ? password : temporaryPassword(length);
}
