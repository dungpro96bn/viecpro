import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  acceptInviteSchema,
  inviteMemberSchema,
  memberRoleSchema,
  removeMemberSchema,
  type AcceptInviteInput,
  type CompanyMembers,
  type InviteMemberInput,
  type MemberInvitePreview,
  type MemberInviteSent,
  type MemberRoleInput,
  type OtpSentResponse,
  type RemoveMemberInput,
} from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Public, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody } from '../../core/http/zod.js';
import { EmployerMembersService } from './employer-members.service.js';
import { MemberInvitesService } from './member-invites.service.js';

const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Nhà tuyển dụng – quản lý')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer/members')
export class EmployerMembersController {
  constructor(private readonly members: EmployerMembersService) {}

  @Get()
  @ApiOperation({ summary: 'Thành viên doanh nghiệp (+ lời mời đang chờ nếu là quản trị viên doanh nghiệp)' })
  list(@CurrentUser() user: AuthPayload): Promise<CompanyMembers> {
    return this.members.list(user.sub);
  }

  @Throttle(STRICT)
  @Post('invites')
  @ApiOperation({ summary: 'Mời cán bộ mới (số chưa có tài khoản) – gửi link qua SMS / email' })
  invite(@CurrentUser() user: AuthPayload, @ZodBody(inviteMemberSchema) body: InviteMemberInput): Promise<MemberInviteSent> {
    return this.members.invite(user.sub, body);
  }

  @Throttle(STRICT)
  @Post('invites/:id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lại lời mời (link mới, gia hạn 7 ngày)' })
  resend(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<MemberInviteSent> {
    return this.members.resend(user.sub, id);
  }

  @Delete('invites/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Huỷ lời mời chưa nhận' })
  async revoke(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.members.revoke(user.sub, id);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Cấp / bỏ quyền quản trị viên doanh nghiệp' })
  setRole(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(memberRoleSchema) body: MemberRoleInput): Promise<CompanyMembers> {
    return this.members.setRole(user.sub, id, body);
  }

  @Post(':id/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gỡ thành viên: đăng xuất mọi thiết bị, bàn giao tin đang mở / hồ sơ / lịch hẹn' })
  remove(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(removeMemberSchema) body: RemoveMemberInput): Promise<CompanyMembers> {
    return this.members.remove(user.sub, id, body);
  }
}

/** Trang nhận lời mời – công khai theo token, giới hạn tần suất chặt */
@ApiTags('Nhà tuyển dụng – lời mời thành viên')
@Public()
@Throttle(STRICT)
@Controller('invites')
export class MemberInvitesController {
  constructor(private readonly invites: MemberInvitesService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Xem lời mời thành viên (doanh nghiệp, người mời, số được mời đã che)' })
  preview(@Param('token') token: string): Promise<MemberInvitePreview> {
    return this.invites.preview(token);
  }

  @Post(':token/otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi mã OTP tới số điện thoại được mời' })
  sendOtp(@Param('token') token: string): Promise<OtpSentResponse> {
    return this.invites.sendOtp(token);
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhận lời mời: xác thực OTP, đặt mật khẩu, tạo tài khoản trong doanh nghiệp' })
  accept(@Param('token') token: string, @ZodBody(acceptInviteSchema) body: AcceptInviteInput): Promise<{ phone: string }> {
    return this.invites.accept(token, body);
  }
}
