import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminLeadListSchema, type AdminLeadList, type AdminLeadListQuery } from '@viecpro/shared';
import type { Request } from 'express';
import { ZodQuery } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { AdminLeadsService } from './admin-leads.service.js';

@ApiTags('Admin – khách cần tư vấn')
@AdminController()
@Controller('admin/leads')
export class AdminLeadsController {
  constructor(private readonly leads: AdminLeadsService) {}

  @RequirePermission('leads.read')
  @Get()
  @ApiOperation({ summary: 'Danh sách khách đăng ký tư vấn, tìm kiếm và phân trang' })
  list(@CurrentAdmin() admin: AdminContext, @ZodQuery(adminLeadListSchema) query: AdminLeadListQuery, @Req() req: Request): Promise<AdminLeadList> {
    return this.leads.list(admin, query, req);
  }

  @RequirePermission('leads.manage')
  @Post(':id/handle')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đánh dấu đã xử lý khách đăng ký tư vấn' })
  async handle(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @Req() req: Request) {
    await this.leads.handle(admin.id, id, req);
  }
}
