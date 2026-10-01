import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  interviewChangeRequestSchema,
  savedJobsApplySchema,
  seekerApplicationListSchema,
  type ApplicationItem,
  type InterviewChangeRequestInput,
  type SavedJobsApplyInput,
  type SavedJobsApplyResult,
  type SeekerApplicationList,
  type SeekerApplicationListQuery,
  type SeekerApplicationSummary,
} from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { SeekerApplicationsService } from './seeker-applications.service.js';

@ApiTags('Ứng tuyển')
@ApiBearerAuth()
@Roles('seeker')
@Controller('me/applications')
export class SeekerApplicationsController {
  constructor(private readonly seeker: SeekerApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'Việc đã ứng tuyển + tiến trình hồ sơ (lọc theo tab, tìm theo tên đơn)' })
  list(@CurrentUser() user: AuthPayload, @ZodQuery(seekerApplicationListSchema) query: SeekerApplicationListQuery): Promise<SeekerApplicationList> {
    return this.seeker.list(user.sub, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Số liệu việc đã ứng tuyển + buổi phỏng vấn gần nhất' })
  summary(@CurrentUser() user: AuthPayload): Promise<SeekerApplicationSummary> {
    return this.seeker.summary(user.sub);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ứng tuyển nhanh nhiều việc đã lưu bằng thông tin hồ sơ (tối đa 5)' })
  bulk(@CurrentUser() user: AuthPayload, @ZodBody(savedJobsApplySchema) body: SavedJobsApplyInput): Promise<SavedJobsApplyResult> {
    return this.seeker.applyMany(user.sub, body);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Rút hồ sơ ứng tuyển' })
  withdraw(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<ApplicationItem> {
    return this.seeker.withdraw(user.sub, id);
  }

  @Post(':id/interview/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận tham gia buổi phỏng vấn sắp tới' })
  confirm(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<ApplicationItem> {
    return this.seeker.confirmInterview(user.sub, id);
  }

  @Post(':id/interview/change-request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Xin đổi giờ phỏng vấn (báo cán bộ tạo lịch)' })
  changeRequest(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(interviewChangeRequestSchema) body: InterviewChangeRequestInput): Promise<ApplicationItem> {
    return this.seeker.requestChange(user.sub, id, body);
  }
}
