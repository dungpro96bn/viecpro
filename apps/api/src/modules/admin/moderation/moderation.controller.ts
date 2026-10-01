import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { moderationQueueSchema, rejectJobSchema, type ModerationQueueQuery, type RejectJobInput } from '@viecpro/shared';
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
  @ApiOperation({ summary: 'Hàng chờ kiểm duyệt có phân trang, tìm kiếm và điểm rủi ro' })
  pending(@ZodQuery(moderationQueueSchema) query: ModerationQueueQuery) {
    return this.moderation.list(query);
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
}
