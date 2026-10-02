import { HttpStatus, Injectable } from '@nestjs/common';
import {
  SUPER_ADMIN_ROLE,
  type AdminAccountItem,
  type AdminAccountList,
  type AdminAccountListQuery,
  type AdminStepUpInput,
  type AdminTemporaryPassword,
  type ChangeAdminRoleInput,
  type CreateAdminInput,
  type LockAdminInput,
} from '@viecpro/shared';
import type { Request } from 'express';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../../core/http/pagination.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { hashPassword } from '../../auth/password.js';
import type { AdminContext } from '../admin-access.js';
import { StepUpService } from '../sanctions/step-up.service.js';
import { assertCanGrant, assertCanManageAccount, assertNotSelf, temporaryPassword } from './admin-policy.js';

const accountSelect = {
  id: true,
  name: true,
  email: true,
  mfaEnabledAt: true,
  lockedAt: true,
  lockReason: true,
  lastLoginAt: true,
  createdAt: true,
  adminRole: { select: { id: true, key: true, name: true, permissions: true } },
} as const;
type AccountRow = Prisma.UserGetPayload<{ select: typeof accountSelect }>;

/** Tài khoản admin còn hoạt động */
const ADMIN_WHERE = { role: 'admin', deletedAt: null } as const satisfies Prisma.UserWhereInput;

/** Quản trị viên (A-11): tạo, đổi vai trò, khoá, đặt lại 2FA / mật khẩu – RULE-BE.md mục 7 */
@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stepUp: StepUpService,
  ) {}

  async list(actor: AdminContext, q: AdminAccountListQuery): Promise<AdminAccountList> {
    const where: Prisma.UserWhereInput = {
      ...ADMIN_WHERE,
      ...(q.roleId && { adminRoleId: q.roleId }),
      ...(q.status === 'active' && { lockedAt: null }),
      ...(q.status === 'locked' && { lockedAt: { not: null } }),
      ...(q.status === 'mfa_pending' && { mfaEnabledAt: null }),
      ...(q.q && { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q.toLowerCase() } }] }),
    };
    const [rows, total, all, locked, mfaPending] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'asc' }, ...pageArgs(q), select: accountSelect }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: ADMIN_WHERE }),
      this.prisma.user.count({ where: { ...ADMIN_WHERE, lockedAt: { not: null } } }),
      this.prisma.user.count({ where: { ...ADMIN_WHERE, mfaEnabledAt: null } }),
    ]);
    return {
      ...paginated(rows.map((r) => this.toItem(r, actor)), total, q),
      stats: { total: all, active: all - locked, locked, mfaPending },
    };
  }

  async create(actor: AdminContext, input: CreateAdminInput, req: Request): Promise<AdminTemporaryPassword> {
    await this.stepUp.assert(actor.id, input.otp);
    const role = await this.role(input.roleId);
    assertCanGrant(actor, role);
    if (await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      throw new ApiException('EMAIL_TAKEN', 'Email đã thuộc một tài khoản khác', HttpStatus.CONFLICT, { email: 'Email đã được sử dụng' });
    }
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { role: 'admin', name: input.name, email: input.email, passwordHash, mustChangePassword: true, adminRoleId: role.id }, select: accountSelect });
      await this.audit.log({ actorId: actor.id, action: 'admin.create', targetType: 'user', targetId: user.id, after: { name: user.name, email: user.email, role: role.key } }, req, tx);
      return user;
    });
    return { admin: this.toItem(created, actor), temporaryPassword: password };
  }

  async changeRole(actor: AdminContext, id: string, input: ChangeAdminRoleInput, req: Request): Promise<AdminAccountItem> {
    assertNotSelf(actor, id, 'Không thể tự đổi vai trò của chính mình');
    await this.stepUp.assert(actor.id, input.otp);
    const target = await this.account(id);
    assertCanManageAccount(actor, target.adminRole!.key);
    const role = await this.role(input.roleId);
    assertCanGrant(actor, role);
    if (role.id === target.adminRole!.id) return this.toItem(target, actor);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (target.adminRole!.key === SUPER_ADMIN_ROLE) await this.assertAnotherSuperAdmin(tx, id);
      const user = await tx.user.update({ where: { id }, data: { adminRoleId: role.id }, select: accountSelect });
      // Đổi quyền → thu hồi mọi phiên của người đó (RULE-BE.md mục 7)
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ actorId: actor.id, action: 'admin.role_change', targetType: 'user', targetId: id, before: { role: target.adminRole!.key }, after: { role: role.key } }, req, tx);
      return user;
    });
    return this.toItem(updated, actor);
  }

  async lock(actor: AdminContext, id: string, input: LockAdminInput, req: Request): Promise<AdminAccountItem> {
    assertNotSelf(actor, id, 'Không thể tự khoá tài khoản của chính mình');
    await this.stepUp.assert(actor.id, input.otp);
    const target = await this.account(id);
    assertCanManageAccount(actor, target.adminRole!.key);
    if (target.lockedAt) throw new ApiException('CONFLICT', 'Tài khoản đã bị khoá', HttpStatus.CONFLICT);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (target.adminRole!.key === SUPER_ADMIN_ROLE) await this.assertAnotherSuperAdmin(tx, id);
      const user = await tx.user.update({ where: { id }, data: { lockedAt: now, lockReason: input.reason }, select: accountSelect });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      await this.audit.log({ actorId: actor.id, action: 'admin.lock', targetType: 'user', targetId: id, before: { lockedAt: null }, after: { lockedAt: now, reason: input.reason } }, req, tx);
      return user;
    });
    return this.toItem(updated, actor);
  }

  async unlock(actor: AdminContext, id: string, req: Request): Promise<AdminAccountItem> {
    assertNotSelf(actor, id);
    const target = await this.account(id);
    assertCanManageAccount(actor, target.adminRole!.key);
    if (!target.lockedAt) throw new ApiException('CONFLICT', 'Tài khoản không bị khoá', HttpStatus.CONFLICT);
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: { lockedAt: null, lockReason: null, failedLogins: 0, loginLockedUntil: null }, select: accountSelect });
      await this.audit.log({ actorId: actor.id, action: 'admin.unlock', targetType: 'user', targetId: id, before: { lockedAt: target.lockedAt, reason: target.lockReason }, after: { lockedAt: null } }, req, tx);
      return user;
    });
    return this.toItem(updated, actor);
  }

  /** Mất điện thoại: xoá khoá 2FA, lần đăng nhập sau phải quét QR lại */
  async resetMfa(actor: AdminContext, id: string, input: AdminStepUpInput, req: Request): Promise<AdminAccountItem> {
    assertNotSelf(actor, id, 'Không thể tự đặt lại 2FA của chính mình');
    await this.stepUp.assert(actor.id, input.otp);
    const target = await this.account(id);
    assertCanManageAccount(actor, target.adminRole!.key);
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: { mfaSecretEnc: null, mfaEnabledAt: null, mfaRecoveryHashes: [] }, select: accountSelect });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ actorId: actor.id, action: 'admin.mfa_reset', targetType: 'user', targetId: id, before: { mfaEnabled: !!target.mfaEnabledAt }, after: { mfaEnabled: false } }, req, tx);
      return user;
    });
    return this.toItem(updated, actor);
  }

  /** Quên mật khẩu: cấp mật khẩu tạm mới (chỉ hiện 1 lần), thu hồi mọi phiên */
  async resetPassword(actor: AdminContext, id: string, input: AdminStepUpInput, req: Request): Promise<AdminTemporaryPassword> {
    assertNotSelf(actor, id, 'Không thể tự đặt lại mật khẩu của chính mình tại đây');
    await this.stepUp.assert(actor.id, input.otp);
    const target = await this.account(id);
    assertCanManageAccount(actor, target.adminRole!.key);
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true, failedLogins: 0, loginLockedUntil: null }, select: accountSelect });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ actorId: actor.id, action: 'admin.password_reset', targetType: 'user', targetId: id }, req, tx);
      return user;
    });
    return { admin: this.toItem(updated, actor), temporaryPassword: password };
  }

  private async account(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, ...ADMIN_WHERE, adminRoleId: { not: null } }, select: accountSelect });
    if (!user?.adminRole) throw ApiException.notFound('Không tìm thấy quản trị viên');
    return user;
  }

  private async role(id: string) {
    const role = await this.prisma.adminRole.findUnique({ where: { id }, select: { id: true, key: true, name: true, permissions: true } });
    if (!role) throw new ApiException('VALIDATION_ERROR', 'Vai trò không tồn tại', HttpStatus.BAD_REQUEST, { roleId: 'Chọn vai trò khác' });
    return role;
  }

  /** Không được để hệ thống mất Super Admin cuối cùng còn hoạt động */
  private async assertAnotherSuperAdmin(tx: Prisma.TransactionClient, exceptId: string) {
    const others = await tx.user.count({ where: { ...ADMIN_WHERE, id: { not: exceptId }, lockedAt: null, adminRole: { key: SUPER_ADMIN_ROLE } } });
    if (!others) throw new ApiException('CONFLICT', 'Phải còn ít nhất 1 Super Admin đang hoạt động', HttpStatus.CONFLICT);
  }

  private toItem(u: AccountRow, actor: AdminContext): AdminAccountItem {
    return {
      id: u.id,
      name: u.name,
      email: u.email ?? '',
      role: { id: u.adminRole?.id ?? '', key: u.adminRole?.key ?? '', name: u.adminRole?.name ?? '' },
      mfaEnabled: !!u.mfaEnabledAt,
      lockedAt: u.lockedAt?.toISOString() ?? null,
      lockReason: u.lockReason,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      isSelf: u.id === actor.id,
    };
  }
}
