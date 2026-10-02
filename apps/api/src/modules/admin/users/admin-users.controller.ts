import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminSeekerListSchema, lockAccountSchema, type AdminSeekerDetail, type AdminSeekerList, type AdminSeekerListQuery, type LockAccountInput, type RevealedContact } from '@viecpro/shared';
import type { Request } from 'express';
import { ZodBody, ZodQuery } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { AdminUsersService } from './admin-users.service.js';

@ApiTags('Admin – ứng viên')
@AdminController()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @RequirePermission('users.read')
  @Get()
  @ApiOperation({ summary: 'Danh sách ứng viên: lọc, thống kê, liên hệ đã che' })
  list(@ZodQuery(adminSeekerListSchema) query: AdminSeekerListQuery): Promise<AdminSeekerList> {
    return this.users.list(query);
  }

  @RequirePermission('users.read')
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết ứng viên (liên hệ đã che)' })
  detail(@Param('id') id: string): Promise<AdminSeekerDetail> {
    return this.users.detail(id);
  }

  @RequirePermission('users.pii')
  @Post(':id/reveal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hiện đầy đủ số điện thoại / email (ghi nhật ký)' })
  reveal(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @Req() req: Request): Promise<RevealedContact> {
    return this.users.reveal(admin.id, id, req);
  }

  @RequirePermission('users.lock')
  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Khoá tài khoản ứng viên (đăng xuất mọi thiết bị)' })
  lock(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(lockAccountSchema) body: LockAccountInput, @Req() req: Request): Promise<AdminSeekerDetail> {
    return this.users.lock(admin.id, id, body, req);
  }

  @RequirePermission('users.lock')
  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mở khoá tài khoản ứng viên' })
  unlock(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @Req() req: Request): Promise<AdminSeekerDetail> {
    return this.users.unlock(admin.id, id, req);
  }
}
