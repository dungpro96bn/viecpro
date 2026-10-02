import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { moderationQueueSchema, rejectJobSchema, type ModerationDetail, type ModerationList, type ModerationQueueQuery, type RejectJobInput } from '@viecpro/shared';
import type { Request } from 'express';
import { ZodBody, ZodQuery } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { ModerationService } from './moderation.service.js';

@ApiTags('Admin – kiểm duyệt tin')
@AdminController()
@Controller('admin/jobs')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @RequirePermission('jobs.read')
  @Get('pending')
  @ApiOperation({ summary: 'Kiểm duyệt tin: tab chờ duyệt / yêu cầu sửa / đã xử lý, lọc nhanh, điểm rủi ro, thống kê' })
  pending(@ZodQuery(moderationQueueSchema) query: ModerationQueueQuery): Promise<ModerationList> {
    return this.moderation.list(query);
  }

  @RequirePermission('jobs.read')
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết tin cần kiểm duyệt: nội dung, kiểm tra tự động, lịch sử, báo cáo' })
  detail(@Param('id') id: string): Promise<ModerationDetail> {
    return this.moderation.detail(id);
  }

  @RequirePermission('jobs.moderate')
  @Post(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Duyệt tin → hiển thị công khai' })
  async approve(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @Req() req: Request) {
    await this.moderation.approve(admin.id, id, req);
  }

  @RequirePermission('jobs.moderate')
  @Post(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Từ chối tin (bắt buộc ghi lý do, gửi cho NTD)' })
  async reject(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(rejectJobSchema) body: RejectJobInput, @Req() req: Request) {
    await this.moderation.reject(admin.id, id, body, req);
  }

  @RequirePermission('jobs.moderate')
  @Post(':id/request-changes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Yêu cầu NTD sửa tin (bắt buộc ghi nội dung cần sửa)' })
  async requestChanges(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(rejectJobSchema) body: RejectJobInput, @Req() req: Request) {
    await this.moderation.requestChanges(admin.id, id, body, req);
  }
}
