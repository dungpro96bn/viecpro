import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { paginationSchema, partnerJobListSchema, type PaginationQuery, type PartnerApplicantItem, type PartnerApplicantList, type PartnerJobListQuery, type ReportCreated } from '@viecpro/shared';
import type { Request } from 'express';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodQuery } from '../../core/http/zod.js';
import { EmployerPartnerViewService } from './employer-partner-view.service.js';

@ApiTags('Nhà tuyển dụng – tin đối tác (chỉ đọc)')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer')
export class EmployerPartnerViewController {
  constructor(private readonly partners: EmployerPartnerViewService) {}

  @Get('partner-jobs')
  @ApiOperation({ summary: 'Tin của tư vấn viên cá nhân đang liên kết với doanh nghiệp – chỉ quản trị viên' })
  listJobs(@CurrentUser() user: AuthPayload, @ZodQuery(partnerJobListSchema) query: PartnerJobListQuery) {
    return this.partners.listJobs(user.sub, query);
  }

  @Get('partner-jobs/:id/applications')
  @ApiOperation({ summary: 'Hồ sơ ứng tuyển tin đối tác – thông tin liên hệ đã che' })
  applications(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodQuery(paginationSchema) query: PaginationQuery): Promise<PartnerApplicantList> {
    return this.partners.listApplications(user.sub, id, query);
  }

  @Get('partner-applications/:id')
  @ApiOperation({ summary: 'Chi tiết hồ sơ tin đối tác, ghi lượt xem' })
  detail(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<PartnerApplicantItem> {
    return this.partners.detail(user.sub, id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('partner-jobs/:id/report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đề nghị admin xem xét tạm ẩn tin đối tác' })
  requestHide(@CurrentUser() user: AuthPayload, @Param('id') id: string, @Req() req: Request): Promise<ReportCreated> {
    return this.partners.requestHide(user.sub, id, req);
  }
}
