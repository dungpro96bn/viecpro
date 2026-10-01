import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { applyEmailOtpSchema, applySchema, type ApplicationItem, type ApplyEmailOtpInput, type ApplyInput, type EmailOtpSentResponse } from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Public } from '../../core/auth/auth.decorators.js';
import { ZodBody } from '../../core/http/zod.js';
import { ApplicationsService } from './applications.service.js';
import { ApplyEmailOtpService } from './apply-email-otp.service.js';

@ApiTags('Ứng tuyển')
@Controller()
export class ApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly otp: ApplyEmailOtpService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('applications/email-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi mã xác nhận (OTP 6 số) tới email ứng tuyển – bắt buộc trước khi gửi hồ sơ' })
  sendEmailOtp(@ZodBody(applyEmailOtpSchema) body: ApplyEmailOtpInput, @CurrentUser() user?: AuthPayload): Promise<EmailOtpSentResponse> {
    return this.otp.send(body, user?.role === 'seeker' ? user.sub : undefined);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('applications')
  @ApiOperation({ summary: 'Ứng tuyển nhanh (không bắt buộc đăng nhập; có token thì gắn vào tài khoản). Cần `emailCode` từ /applications/email-otp' })
  apply(@ZodBody(applySchema) body: ApplyInput, @CurrentUser() user?: AuthPayload): Promise<ApplicationItem> {
    return this.applications.apply(body, user?.role === 'seeker' ? user.sub : undefined);
  }
}
