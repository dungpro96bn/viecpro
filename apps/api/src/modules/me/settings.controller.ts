import { Controller, Delete, Get, Header, HttpCode, HttpStatus, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  changeEmailConfirmSchema,
  changeEmailRequestSchema,
  changePhoneConfirmSchema,
  changePhoneRequestSchema,
  settingsUpdateSchema,
  type ChangeEmailConfirmInput,
  type ChangeEmailRequestInput,
  type ChangePhoneConfirmInput,
  type ChangePhoneRequestInput,
  type EmailOtpSentResponse,
  type OtpSentResponse,
  type PersonalDataExport,
  type SeekerSettings,
  type SettingsUpdateInput,
} from '@viecpro/shared';
import type { Response } from 'express';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody } from '../../core/http/zod.js';
import { AccountSettingsService } from './account-settings.service.js';

const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Tài khoản – cài đặt')
@ApiBearerAuth()
@Roles('seeker', 'employer')
@Controller('me')
export class SettingsController {
  constructor(private readonly settings: AccountSettingsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Cài đặt: tài khoản, thông báo theo kênh, giờ yên lặng, quyền riêng tư, ngôn ngữ' })
  get(@CurrentUser() user: AuthPayload): Promise<SeekerSettings> {
    return this.settings.get(user.sub);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Cập nhật cài đặt (gửi mục nào sửa mục đó)' })
  update(@CurrentUser() user: AuthPayload, @ZodBody(settingsUpdateSchema) body: SettingsUpdateInput): Promise<SeekerSettings> {
    return this.settings.update(user.sub, body);
  }

  @Throttle(STRICT)
  @Post('email/otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi email bước 1: gửi mã xác nhận tới email mới' })
  requestEmail(@CurrentUser() user: AuthPayload, @ZodBody(changeEmailRequestSchema) body: ChangeEmailRequestInput): Promise<EmailOtpSentResponse> {
    return this.settings.requestEmailChange(user.sub, body);
  }

  @Throttle(STRICT)
  @Post('email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi email bước 2: nhập mã → email mới đã xác thực' })
  confirmEmail(@CurrentUser() user: AuthPayload, @ZodBody(changeEmailConfirmSchema) body: ChangeEmailConfirmInput): Promise<SeekerSettings> {
    return this.settings.confirmEmailChange(user.sub, body);
  }

  @Throttle(STRICT)
  @Post('phone/otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi số điện thoại bước 1: xác nhận mật khẩu, gửi OTP tới số mới' })
  requestPhone(@CurrentUser() user: AuthPayload, @ZodBody(changePhoneRequestSchema) body: ChangePhoneRequestInput): Promise<OtpSentResponse> {
    return this.settings.requestPhoneChange(user.sub, body);
  }

  @Throttle(STRICT)
  @Post('phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi số điện thoại bước 2: nhập OTP' })
  confirmPhone(@CurrentUser() user: AuthPayload, @ZodBody(changePhoneConfirmSchema) body: ChangePhoneConfirmInput): Promise<SeekerSettings> {
    return this.settings.confirmPhoneChange(user.sub, body);
  }

  @Delete('sessions')
  @ApiOperation({ summary: 'Đăng xuất tất cả thiết bị khác (giữ thiết bị hiện tại)' })
  revokeOthers(@CurrentUser() user: AuthPayload): Promise<{ revoked: number }> {
    return this.settings.revokeOtherSessions(user.sub, user.sid);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get('export')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Tải dữ liệu cá nhân (JSON) – Nghị định 13/2023' })
  async export(@CurrentUser() user: AuthPayload, @Res({ passthrough: true }) res: Response): Promise<PersonalDataExport> {
    res.setHeader('Content-Disposition', `attachment; filename="viecpro-du-lieu-cua-toi-${new Date().toISOString().slice(0, 10)}.json"`);
    return this.settings.exportData(user.sub);
  }
}
