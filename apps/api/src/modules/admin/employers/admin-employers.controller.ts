import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminEmployerListSchema, employerSanctionSchema, type AdminEmployerDetail, type AdminEmployerList, type AdminEmployerListQuery, type EmployerSanctionInput } from '@viecpro/shared';
import type { Request } from 'express';
import { ZodBody, ZodQuery } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { AdminEmployersService } from './admin-employers.service.js';

@ApiTags('Admin – nhà tuyển dụng')
@AdminController()
@Controller('admin/employers')
export class AdminEmployersController {
  constructor(private readonly employers: AdminEmployersService) {}

  @RequirePermission('employers.read')
  @Get()
  @ApiOperation({ summary: 'Danh sách nhà tuyển dụng (công ty XKLĐ + NTD cá nhân), thống kê, lọc' })
  list(@ZodQuery(adminEmployerListSchema) query: AdminEmployerListQuery): Promise<AdminEmployerList> {
    return this.employers.list(query);
  }

  @RequirePermission('employers.read')
  @Get(':kind/:id')
  @ApiOperation({ summary: 'Chi tiết NTD: tổng quan, tin đăng, gói, vi phạm, lịch sử (kind = company | individual)' })
  detail(@Param('kind') kind: string, @Param('id') id: string): Promise<AdminEmployerDetail> {
    return this.employers.detail(kind, id);
  }

  @RequirePermission('jobs.moderate')
  @Post(':kind/:id/warn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cảnh cáo nhà tuyển dụng (gửi thông báo, ghi nhật ký)' })
  warn(@CurrentAdmin() admin: AdminContext, @Param('kind') kind: string, @Param('id') id: string, @ZodBody(employerSanctionSchema) body: EmployerSanctionInput, @Req() req: Request): Promise<AdminEmployerDetail> {
    return this.employers.warn(admin.id, kind, id, body.reason, req);
  }

  @RequirePermission('users.lock')
  @Post(':kind/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạm khoá NTD: ẩn mọi tin, khoá thành viên (cần mã 2FA `otp`)' })
  suspend(@CurrentAdmin() admin: AdminContext, @Param('kind') kind: string, @Param('id') id: string, @ZodBody(employerSanctionSchema) body: EmployerSanctionInput, @Req() req: Request): Promise<AdminEmployerDetail> {
    return this.employers.suspend(admin.id, kind, id, body.reason, body.otp, req);
  }

  @RequirePermission('users.lock')
  @Post(':kind/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mở khoá NTD: khôi phục tin bị ẩn do tạm khoá' })
  unsuspend(@CurrentAdmin() admin: AdminContext, @Param('kind') kind: string, @Param('id') id: string, @Req() req: Request): Promise<AdminEmployerDetail> {
    return this.employers.unsuspend(admin.id, kind, id, req);
  }
}
