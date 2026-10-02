import { HttpStatus, Injectable } from '@nestjs/common';
import { SUPER_ADMIN_ROLE, type AdminRoleItem, type AdminStepUpInput, type CreateAdminRoleInput, type UpdateAdminRoleInput } from '@viecpro/shared';
import type { Request } from 'express';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { AdminContext } from '../admin-access.js';
import { StepUpService } from '../sanctions/step-up.service.js';
import { assertCanGrant, normalizePermissions } from './admin-policy.js';

const roleSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  permissions: true,
  isSystem: true,
  updatedAt: true,
  _count: { select: { users: { where: { role: 'admin', deletedAt: null } } } },
} as const;

/** Vai trò quản trị (A-11): quyền gán qua vai trò, không gán trực tiếp cho từng người (RULE-BE.md mục 6 lớp 3) */
@Injectable()
export class AdminRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stepUp: StepUpService,
  ) {}

  async list(): Promise<AdminRoleItem[]> {
    const rows = await this.prisma.adminRole.findMany({ orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }], select: roleSelect });
    return rows.map((r) => this.toItem(r));
  }

  async create(actor: AdminContext, input: CreateAdminRoleInput, req: Request): Promise<AdminRoleItem> {
    await this.stepUp.assert(actor.id, input.otp);
    const permissions = normalizePermissions(input.permissions);
    assertCanGrant(actor, { key: input.key, permissions });
    if (await this.prisma.adminRole.findUnique({ where: { key: input.key }, select: { id: true } })) {
      throw new ApiException('CONFLICT', 'Mã vai trò đã tồn tại', HttpStatus.CONFLICT, { key: 'Chọn mã khác' });
    }
    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminRole.create({ data: { key: input.key, name: input.name, description: input.description || null, permissions }, select: roleSelect });
      await this.audit.log({ actorId: actor.id, action: 'role.create', targetType: 'admin_role', targetId: created.id, after: { key: created.key, name: created.name, permissions } }, req, tx);
      return created;
    });
    return this.toItem(role);
  }

  async update(actor: AdminContext, id: string, input: UpdateAdminRoleInput, req: Request): Promise<AdminRoleItem> {
    await this.stepUp.assert(actor.id, input.otp);
    const current = await this.find(id);
    const permissions = normalizePermissions(input.permissions);
    if (current.key === SUPER_ADMIN_ROLE && permissions.length !== normalizePermissions(current.permissions).length) {
      throw new ApiException('FORBIDDEN', 'Vai trò Super Admin luôn giữ toàn bộ quyền', HttpStatus.FORBIDDEN);
    }
    if (current.id === (await this.actorRoleId(actor))) {
      throw new ApiException('FORBIDDEN', 'Không thể tự sửa vai trò mình đang giữ', HttpStatus.FORBIDDEN);
    }
    // Cả quyền cũ lẫn quyền mới đều phải nằm trong quyền của người sửa
    assertCanGrant(actor, current);
    assertCanGrant(actor, { key: current.key, permissions });

    const changed = permissions.join() !== normalizePermissions(current.permissions).join();
    const role = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.adminRole.update({ where: { id }, data: { name: input.name, description: input.description || null, permissions }, select: roleSelect });
      // Đổi quyền → thu hồi mọi phiên của admin giữ vai trò này
      if (changed) await tx.session.updateMany({ where: { revokedAt: null, user: { adminRoleId: id } }, data: { revokedAt: new Date() } });
      await this.audit.log(
        { actorId: actor.id, action: 'role.update', targetType: 'admin_role', targetId: id, before: { name: current.name, permissions: current.permissions }, after: { name: updated.name, permissions } },
        req,
        tx,
      );
      return updated;
    });
    return this.toItem(role);
  }

  async remove(actor: AdminContext, id: string, input: AdminStepUpInput, req: Request): Promise<void> {
    await this.stepUp.assert(actor.id, input.otp);
    const role = await this.find(id);
    if (role.isSystem) throw new ApiException('FORBIDDEN', 'Không xoá được vai trò mặc định', HttpStatus.FORBIDDEN);
    assertCanGrant(actor, role);
    if (role._count.users) throw new ApiException('CONFLICT', 'Vai trò đang được gán cho quản trị viên, hãy chuyển họ sang vai trò khác trước', HttpStatus.CONFLICT);
    await this.prisma.$transaction(async (tx) => {
      await tx.adminRole.delete({ where: { id } });
      await this.audit.log({ actorId: actor.id, action: 'role.delete', targetType: 'admin_role', targetId: id, before: { key: role.key, name: role.name, permissions: role.permissions } }, req, tx);
    });
  }

  private async find(id: string) {
    const role = await this.prisma.adminRole.findUnique({ where: { id }, select: roleSelect });
    if (!role) throw ApiException.notFound('Không tìm thấy vai trò');
    return role;
  }

  private async actorRoleId(actor: AdminContext) {
    return (await this.prisma.user.findUnique({ where: { id: actor.id }, select: { adminRoleId: true } }))?.adminRoleId;
  }

  private toItem(r: { id: string; key: string; name: string; description: string | null; permissions: string[]; isSystem: boolean; updatedAt: Date; _count: { users: number } }): AdminRoleItem {
    return {
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: normalizePermissions(r.permissions),
      isSystem: r.isSystem,
      adminCount: r._count.users,
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
