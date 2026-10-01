import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@viecpro/shared';
import { ApiException } from '../http/api-exception.js';
import { type AuthPayload, type AuthRequest, IS_PUBLIC, ROLES } from './auth.decorators.js';

/**
 * Guard toàn cục: mặc định MỌI route cần đăng nhập, trừ route gắn @Public().
 * Token đọc từ header "Authorization: Bearer <accessToken>" (web và mobile như nhau).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];

    if (token) {
      try {
        req.user = await this.jwt.verifyAsync<AuthPayload>(token);
      } catch {
        // Route công khai vẫn cho qua khi token hết hạn; route riêng tư báo để app gọi /auth/refresh
        if (!isPublic) throw new ApiException('TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn', HttpStatus.UNAUTHORIZED);
      }
    }

    if (isPublic) return true;
    if (!req.user) throw new ApiException('UNAUTHORIZED', 'Vui lòng đăng nhập', HttpStatus.UNAUTHORIZED);

    // Không có ngoại lệ cho admin: admin làm việc qua /admin/* (RULE-BE.md mục 6 lớp 1)
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles?.length && !roles.includes(req.user.role)) throw ApiException.forbidden();
    return true;
  }
}
