import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changePasswordSchema,
  completeUploadSchema,
  presignUploadSchema,
  pushTokenSchema,
  seekerDocumentUploadSchema,
  seekerProfileSchema,
  type AuthUser,
  type ChangePasswordInput,
  type CompleteUploadInput,
  type PresignUploadInput,
  type PresignedUpload,
  type PushTokenInput,
  type SeekerDashboard,
  type SeekerDocument,
  type SeekerDocumentUploadInput,
  type SeekerProfile,
  type SeekerProfileInsights,
  type SeekerProfileInput,
  type SessionItem,
} from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody } from '../../core/http/zod.js';
import { MeService } from './me.service.js';
import { SeekerProfileService } from './seeker-profile.service.js';

@ApiTags('Tài khoản')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly seeker: SeekerProfileService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Thông tin tài khoản đang đăng nhập' })
  get(@CurrentUser() user: AuthPayload): Promise<AuthUser> {
    return this.me.me(user.sub);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá tài khoản (yêu cầu của App Store / Google Play)' })
  async remove(@CurrentUser() user: AuthPayload) {
    await this.me.deleteAccount(user.sub);
  }

  @Roles('seeker')
  @Get('profile')
  @ApiOperation({ summary: 'Hồ sơ ứng viên + % hoàn thiện + gợi ý bổ sung' })
  profile(@CurrentUser() user: AuthPayload): Promise<SeekerProfile> {
    return this.seeker.profile(user.sub);
  }

  @Roles('seeker')
  @Patch('profile')
  @ApiOperation({ summary: 'Cập nhật hồ sơ ứng viên (gửi trường nào sửa trường đó)' })
  updateProfile(@CurrentUser() user: AuthPayload, @ZodBody(seekerProfileSchema) body: SeekerProfileInput): Promise<SeekerProfile> {
    return this.seeker.update(user.sub, body);
  }

  @Roles('seeker')
  @Get('profile/insights')
  @ApiOperation({ summary: 'Lượt NTD xem hồ sơ, số đơn phù hợp, doanh nghiệp đã xem (đã xác minh)' })
  insights(@CurrentUser() user: AuthPayload): Promise<SeekerProfileInsights> {
    return this.seeker.insights(user.sub);
  }

  @Roles('seeker')
  @Put('profile/documents/:key')
  @ApiOperation({ summary: 'Gắn tệp đã tải lên vào mục giấy tờ xuất cảnh (chờ cán bộ xác minh)' })
  uploadDocument(@CurrentUser() user: AuthPayload, @Param('key') key: string, @ZodBody(seekerDocumentUploadSchema) body: SeekerDocumentUploadInput): Promise<SeekerDocument[]> {
    return this.seeker.uploadDocument(user.sub, key, body);
  }

  @Roles('seeker')
  @Get('dashboard')
  @ApiOperation({ summary: 'Số liệu trang tổng quan: hồ sơ đã ứng tuyển, lịch phỏng vấn, việc đã lưu, lượt xem hồ sơ' })
  dashboard(@CurrentUser() user: AuthPayload): Promise<SeekerDashboard> {
    return this.me.dashboard(user.sub);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đổi mật khẩu (đăng xuất các thiết bị khác)' })
  async changePassword(@CurrentUser() user: AuthPayload, @ZodBody(changePasswordSchema) body: ChangePasswordInput) {
    await this.me.changePassword(user.sub, user.sid, body);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Thiết bị đang đăng nhập' })
  sessions(@CurrentUser() user: AuthPayload): Promise<SessionItem[]> {
    return this.me.sessionsList(user.sub, user.sid);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đăng xuất một thiết bị' })
  async revokeSession(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.me.revokeSession(user.sub, id);
  }

  @Put('push-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'App mobile đăng ký token nhận thông báo đẩy' })
  async savePushToken(@CurrentUser() user: AuthPayload, @ZodBody(pushTokenSchema) body: PushTokenInput) {
    await this.me.savePushToken(user.sub, body);
  }

  @Delete('push-tokens/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Huỷ token thông báo đẩy (khi đăng xuất trên app)' })
  async removePushToken(@CurrentUser() user: AuthPayload, @Param('token') token: string) {
    await this.me.removePushToken(user.sub, token);
  }

  @Roles('seeker', 'employer')
  @Post('assets/presign')
  @ApiOperation({ summary: 'Cấp URL ký để tải ảnh hoặc video hồ sơ trực tiếp lên kho tệp' })
  presignUpload(@CurrentUser() user: AuthPayload, @ZodBody(presignUploadSchema) body: PresignUploadInput): Promise<PresignedUpload> {
    return this.me.presignUpload(user.sub, body);
  }

  @Roles('seeker', 'employer')
  @Post('assets/complete')
  @ApiOperation({ summary: 'Kiểm tra nội dung tệp sau khi tải lên kho' })
  completeUpload(@CurrentUser() user: AuthPayload, @ZodBody(completeUploadSchema) body: CompleteUploadInput): Promise<{ assetUrl: string; assetPath: string }> {
    return this.me.completeUpload(user.sub, body);
  }
}
