import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ADMIN_PERMISSIONS, type AdminPermission } from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';
import { type AuthRequest, Roles } from '../../core/auth/auth.decorators.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { SessionService } from '../auth/session.service.js';

const PERMISSION = 'admin:permission';
const ANY_ADMIN = '*';

/** Quyền cần có cho route admin. Route admin thiếu decorator này sẽ bị từ chối (fail-closed). */
export const RequirePermission = (permission: AdminPermission) => SetMetadata(PERMISSION, permission);

/** Route mọi admin đã đăng nhập đều dùng được (thông tin bản thân, đăng xuất) */
export const AnyAdmin = () => SetMetadata(PERMISSION, ANY_ADMIN);

/** Người đang thao tác trong khu quản trị, gắn vào req.admin sau khi qua AdminGuard */
export interface AdminContext {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  permissions: AdminPermission[];
}

export type AdminRequest = AuthRequest & { admin?: AdminContext };

/**
 * Lớp kiểm tra thứ 2 cho /admin/* (sau AuthGuard toàn cục):
 * 1. IP nằm trong ADMIN_IP_ALLOWLIST (nếu cấu hình)
 * 2. Token là phiên admin đã qua 2FA (adm = true)
 * 3. Kiểm tra DB mỗi request: phiên chưa thu hồi / hết hạn, tài khoản chưa khoá
 * 4. Không còn dùng mật khẩu tạm (trừ route @AnyAdmin)
 * 5. Vai trò quản trị có quyền khai báo bằng @RequirePermission
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const permission = this.reflector.getAllAndOverride<AdminPermission | typeof ANY_ADMIN | undefined>(PERMISSION, [ctx.getHandler(), ctx.getClass()]);
    if (!permission) throw ApiException.forbidden('Route quản trị chưa khai báo quyền');

    if (this.env.ADMIN_IP_ALLOWLIST.length && !this.env.ADMIN_IP_ALLOWLIST.includes(req.ip ?? '')) {
      throw ApiException.forbidden('Địa chỉ IP không được phép truy cập trang quản trị');
    }

    const user = req.user;
    if (!user || user.role !== 'admin' || !user.adm) throw ApiException.forbidden();
    if (!(await this.sessions.isActive(user.sid, user.sub))) {
      throw new ApiException('TOKEN_EXPIRED', 'Phiên quản trị đã hết hạn, vui lòng đăng nhập lại', HttpStatus.UNAUTHORIZED);
    }

    const admin = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, name: true, email: true, mfaEnabledAt: true, mustChangePassword: true, adminRole: { select: { key: true, name: true, permissions: true } } },
    });
    // ADMIN_MFA_BYPASS chỉ có ở dev / test (env.ts từ chối ở production) – khi đó phiên được cấp không qua 2FA
    if (!admin?.adminRole || (!admin.mfaEnabledAt && !this.env.ADMIN_MFA_BYPASS)) throw ApiException.forbidden();

    // Mật khẩu tạm: chỉ cho xem bản thân, đổi mật khẩu, đăng xuất
    if (admin.mustChangePassword && permission !== ANY_ADMIN) {
      throw new ApiException('PASSWORD_CHANGE_REQUIRED', 'Hãy đổi mật khẩu tạm trước khi tiếp tục', HttpStatus.FORBIDDEN);
    }

    const permissions = admin.adminRole.permissions.filter((p): p is AdminPermission => (ADMIN_PERMISSIONS as readonly string[]).includes(p));
    if (permission !== ANY_ADMIN && !permissions.includes(permission)) throw ApiException.forbidden(`Bạn chưa có quyền "${permission}"`);

    req.admin = {
      id: admin.id,
      name: admin.name,
      email: admin.email ?? '',
      roleKey: admin.adminRole.key,
      roleName: admin.adminRole.name,
      permissions,
    };
    return true;
  }
}

/** Gắn cho mọi controller trong khu quản trị */
export const AdminController = () => applyDecorators(Roles('admin'), UseGuards(AdminGuard), ApiBearerAuth());
