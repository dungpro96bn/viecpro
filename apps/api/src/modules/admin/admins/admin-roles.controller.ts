import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminStepUpSchema,
  createAdminRoleSchema,
  updateAdminRoleSchema,
  type AdminRoleItem,
  type AdminStepUpInput,
  type CreateAdminRoleInput,
  type UpdateAdminRoleInput,
} from '@viecpro/shared';
import type { Request } from 'express';
import { ZodBody } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { AdminRolesService } from './admin-roles.service.js';

@ApiTags('Admin – phân quyền')
@AdminController()
@Controller('admin/roles')
export class AdminRolesController {
  constructor(private readonly roles: AdminRolesService) {}

  @RequirePermission('admins.manage')
  @Get()
  @ApiOperation({ summary: 'Danh sách vai trò quản trị và quyền của từng vai trò' })
  list(): Promise<AdminRoleItem[]> {
    return this.roles.list();
  }

  @RequirePermission('admins.manage')
  @Post()
  @ApiOperation({ summary: 'Tạo vai trò quản trị (chỉ cấp được quyền mình có, cần mã 2FA `otp`)' })
  create(@CurrentAdmin() admin: AdminContext, @ZodBody(createAdminRoleSchema) body: CreateAdminRoleInput, @Req() req: Request): Promise<AdminRoleItem> {
    return this.roles.create(admin, body, req);
  }

  @RequirePermission('admins.manage')
  @Put(':id')
  @ApiOperation({ summary: 'Sửa tên / quyền của vai trò (đổi quyền thu hồi phiên của admin liên quan, cần mã 2FA `otp`)' })
  update(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(updateAdminRoleSchema) body: UpdateAdminRoleInput, @Req() req: Request): Promise<AdminRoleItem> {
    return this.roles.update(admin, id, body, req);
  }

  @RequirePermission('admins.manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá vai trò tự tạo chưa gán cho ai (cần mã 2FA `otp`)' })
  async remove(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(adminStepUpSchema) body: AdminStepUpInput, @Req() req: Request): Promise<void> {
    await this.roles.remove(admin, id, body, req);
  }
}
