import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminReportListSchema, reportDecisionSchema, type AdminReportDetail, type AdminReportList, type AdminReportListQuery, type ReportDecisionInput } from '@viecpro/shared';
import type { Request } from 'express';
import { ApiException } from '../../../core/http/api-exception.js';
import { ZodBody, ZodQuery } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { AdminReportsService } from './admin-reports.service.js';

@ApiTags('Admin – báo cáo vi phạm')
@AdminController()
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: AdminReportsService) {}

  @RequirePermission('jobs.moderate')
  @Get()
  @ApiOperation({ summary: 'Báo cáo vi phạm đã gộp theo đối tượng, ưu tiên mức độ × hạn xử lý' })
  list(@ZodQuery(adminReportListSchema) query: AdminReportListQuery, @CurrentAdmin() admin: AdminContext): Promise<AdminReportList> {
    return this.reports.list(query, admin.id);
  }

  @RequirePermission('jobs.moderate')
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết vụ báo cáo (mọi báo cáo cùng đối tượng + lý do)' })
  detail(@Param('id') id: string, @CurrentAdmin() admin: AdminContext): Promise<AdminReportDetail> {
    return this.reports.detail(id, admin.id);
  }

  @RequirePermission('jobs.moderate')
  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhận xử lý vụ báo cáo' })
  claim(@Param('id') id: string, @CurrentAdmin() admin: AdminContext, @Req() req: Request): Promise<AdminReportDetail> {
    return this.reports.claim(admin.id, id, req);
  }

  @RequirePermission('jobs.moderate')
  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quyết định: bỏ qua / cảnh cáo / gỡ tin / tạm khoá / khoá vĩnh viễn (khoá cần mã 2FA `otp`)' })
  decide(@Param('id') id: string, @ZodBody(reportDecisionSchema) body: ReportDecisionInput, @CurrentAdmin() admin: AdminContext, @Req() req: Request): Promise<AdminReportDetail> {
    // Khoá tài khoản / NTD cần thêm quyền users.lock
    if ((body.decision === 'suspend' || body.decision === 'ban') && !admin.permissions.includes('users.lock')) throw ApiException.forbidden('Bạn chưa có quyền "users.lock"');
    return this.reports.decide(admin.id, id, body, req);
  }
}
