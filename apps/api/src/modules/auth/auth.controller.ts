import { Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  googleLoginSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  sendOtpSchema,
  verifyRegisterSchema,
  type AuthResponse,
  type GoogleLoginInput,
  type LoginInput,
  type OtpSentResponse,
  type RefreshInput,
  type RegisterInput,
  type ResetPasswordInput,
  type SendOtpInput,
  type VerifyRegisterInput,
} from '@viecpro/shared';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../../config/env.js';
import { type AuthPayload, CurrentUser, Public } from '../../core/auth/auth.decorators.js';
import { ApiException } from '../../core/http/api-exception.js';
import { assertCsrfHeader } from '../../core/http/csrf.js';
import { ZodBody } from '../../core/http/zod.js';
import { AuthService } from './auth.service.js';
import { type DeviceInfo, type IssuedTokens, SessionService } from './session.service.js';

/** Cookie refresh token cho web (mobile nhận refreshToken trong body) */
const REFRESH_COOKIE = 'vp_refresh';
const COOKIE_PATH = '/api/v1/auth';
/** Giới hạn chặt cho các route gửi OTP / đăng nhập: 5 lần / phút / IP */
const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private device(req: Request, body: { platform?: DeviceInfo['platform']; deviceName?: string }): DeviceInfo {
    return { platform: body.platform ?? 'web', deviceName: body.deviceName, userAgent: req.headers['user-agent'], ip: req.ip };
  }

  private setCookie(res: Response, tokens: IssuedTokens) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: COOKIE_PATH,
      maxAge: this.env.REFRESH_TTL_DAYS * 86400_000,
    });
  }

  @Public()
  @Throttle(STRICT)
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký bước 1: tạo tài khoản + gửi OTP' })
  register(@ZodBody(registerSchema) body: RegisterInput): Promise<OtpSentResponse> {
    return this.auth.register(body);
  }

  @Public()
  @Throttle(STRICT)
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng ký bước 2: xác thực OTP và đăng nhập' })
  async verifyRegister(
    @ZodBody(verifyRegisterSchema) body: VerifyRegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const device = this.device(req, body);
    const { response, tokens } = await this.auth.verifyRegister(body, device);
    if (device.platform === 'web') this.setCookie(res, tokens);
    return response;
  }

  @Public()
  @Throttle(STRICT)
  @Post('otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lại mã OTP (đăng ký, đăng nhập, quên mật khẩu)' })
  sendOtp(@ZodBody(sendOtpSchema) body: SendOtpInput): Promise<OtpSentResponse> {
    return this.auth.sendOtp(body);
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng email hoặc số điện thoại' })
  async login(@ZodBody(loginSchema) body: LoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const device = this.device(req, body);
    const { response, tokens } = await this.auth.login(body, device);
    if (device.platform === 'web') this.setCookie(res, tokens);
    return response;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy access token mới. Web: cookie; mobile: gửi refreshToken trong body' })
  async refresh(@ZodBody(refreshSchema) body: RefreshInput, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const cookieToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const token = body.refreshToken ?? cookieToken;
    if (!token) throw new ApiException('TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn', HttpStatus.UNAUTHORIZED);
    // Chống CSRF khi dùng cookie: trang lạ không tự thêm được header này (RULE-BE.md mục 9.3)
    if (!body.refreshToken) assertCsrfHeader(req);
    const { response, tokens } = await this.auth.refresh(token, { platform: body.platform });
    if (body.platform === 'web') this.setCookie(res, tokens);
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất thiết bị hiện tại' })
  async logout(@CurrentUser() user: AuthPayload, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revoke(user.sid, user.sub);
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }

  @Public()
  @Throttle(STRICT)
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng OTP (gửi OTP purpose=reset_password trước)' })
  async resetPassword(@ZodBody(resetPasswordSchema) body: ResetPasswordInput) {
    await this.auth.resetPassword(body);
  }

  @Public()
  @Throttle(STRICT)
  @Post('google')
  @ApiOperation({ summary: 'Đăng nhập bằng Google ID token đã xác thực' })
  async google(@ZodBody(googleLoginSchema) body: GoogleLoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const device = this.device(req, body);
    const { response, tokens } = await this.auth.googleLogin(body.idToken, device);
    if (device.platform === 'web') this.setCookie(res, tokens);
    return response;
  }
}
