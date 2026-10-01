import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@viecpro/shared';
import type { Request } from 'express';

/** Thông tin người dùng lấy từ access token */
export interface AuthPayload {
  /** user id */
  sub: string;
  role: Role;
  /** session id – để đăng xuất đúng thiết bị */
  sid: string;
  /** Phiên quản trị (đăng nhập qua /auth/admin + 2FA) */
  adm?: true;
}

export type AuthRequest = Request & { user?: AuthPayload };

export const IS_PUBLIC = 'auth:public';
export const ROLES = 'auth:roles';

/**
 * Route không bắt buộc đăng nhập. Nếu có token hợp lệ thì vẫn gắn req.user
 * (vd. danh sách việc làm trả thêm "saved" khi đã đăng nhập).
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Giới hạn vai trò: @Roles('employer') */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Lấy người dùng hiện tại: @CurrentUser() user: AuthPayload (undefined nếu route Public và chưa đăng nhập) */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthRequest>().user);
