import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  adminChangePasswordSchema,
  adminLoginSchema,
  adminMfaSchema,
  adminMfaSetupSchema,
  type AdminChangePasswordInput,
  type AdminLoginInput,
  type AdminLoginResult,
  type AdminMe,
  type AdminMfaInput,
  type AdminMfaSetupInput,
} from '@viecpro/shared';
import type { Request, Response } from 'express';
import { Inject } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env.js';
import { type AuthPayload, CurrentUser, Public } from '../../../core/auth/auth.decorators.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { assertCsrfHeader } from '../../../core/http/csrf.js';
import { ZodBody } from '../../../core/http/zod.js';
import type { IssuedTokens } from '../../auth/session.service.js';
import { AdminController, AnyAdmin } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import type { AdminContext } from '../admin-access.js';
import { AdminAuthService } from './admin-auth.service.js';

/** Cookie refresh của admin: tách hẳn với web, SameSite=Strict, sống tối đa 12 giờ */
const ADMIN_COOKIE = 'vp_admin_refresh';
const ADMIN_COOKIE_PATH = '/api/v1/auth/admin';
const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Admin – đăng nhập')
@Public()
@Controller('auth/admin')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private setCookie(res: Response, tokens: IssuedTokens) {
    res.cookie(ADMIN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: ADMIN_COOKIE_PATH,
      maxAge: 12 * 3600_000,
    });
  }

  @Throttle(STRICT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập admin bước 1: email + mật khẩu → yêu cầu 2FA' })
  async login(@ZodBody(adminLoginSchema) body: AdminLoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AdminLoginResult> {
    const { result, tokens } = await this.auth.login(body, req);
    if (tokens) this.setCookie(res, tokens);
    return result;
  }

  @Throttle(STRICT)
  @Post('mfa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập admin bước 2: mã 2FA hoặc mã khôi phục' })
  async mfa(@ZodBody(adminMfaSchema) body: AdminMfaInput, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AdminLoginResult> {
    const { result, tokens } = await this.auth.verifyMfa(body, req);
    this.setCookie(res, tokens);
    return result;
  }

  @Throttle(STRICT)
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lần đầu đăng nhập: xác nhận mã để bật 2FA, nhận mã khôi phục' })
  async setup(@ZodBody(adminMfaSetupSchema) body: AdminMfaSetupInput, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AdminLoginResult> {
    const { result, tokens } = await this.auth.setupMfa(body, req);
    this.setCookie(res, tokens);
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp lại access token từ cookie (bắt buộc header X-Requested-With: viecpro)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AdminLoginResult> {
    assertCsrfHeader(req);
    const token = req.cookies?.[ADMIN_COOKIE] as string | undefined;
    if (!token) throw new ApiException('TOKEN_EXPIRED', 'Phiên quản trị đã hết hạn', HttpStatus.UNAUTHORIZED);
    const { tokens, admin } = await this.auth.refresh(token);
    this.setCookie(res, tokens);
    return { step: 'done', accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, admin };
  }
}

@ApiTags('Admin – tài khoản')
@AdminController()
@Controller('admin')
export class AdminMeController {
  constructor(private readonly auth: AdminAuthService) {}

  @AnyAdmin()
  @Get('me')
  @ApiOperation({ summary: 'Admin đang đăng nhập: vai trò và danh sách quyền' })
  me(@CurrentAdmin() admin: AdminContext): Promise<AdminMe> {
    return this.auth.me(admin.id);
  }

  @AnyAdmin()
  @Throttle(STRICT)
  @Post('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tự đổi mật khẩu (bắt buộc khi đang dùng mật khẩu tạm); đăng xuất các thiết bị khác' })
  changePassword(@CurrentUser() user: AuthPayload, @ZodBody(adminChangePasswordSchema) body: AdminChangePasswordInput, @Req() req: Request): Promise<AdminMe> {
    return this.auth.changePassword(user.sub, user.sid, body, req);
  }

  @AnyAdmin()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đăng xuất khu quản trị' })
  async logout(@CurrentUser() user: AuthPayload, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sub, user.sid, req);
    res.clearCookie(ADMIN_COOKIE, { path: ADMIN_COOKIE_PATH });
  }
}
