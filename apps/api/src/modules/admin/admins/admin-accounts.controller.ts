import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminAccountListSchema,
  adminStepUpSchema,
  changeAdminRoleSchema,
  createAdminSchema,
  lockAdminSchema,
  type AdminAccountItem,
  type AdminAccountList,
  type AdminAccountListQuery,
  type AdminStepUpInput,
  type AdminTemporaryPassword,
  type ChangeAdminRoleInput,
  type CreateAdminInput,
  type LockAdminInput,
} from '@viecpro/shared';
import type { Request } from 'express';
import { ZodBody, ZodQuery } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { AdminAccountsService } from './admin-accounts.service.js';

@ApiTags('Admin – phân quyền')
@AdminController()
@Controller('admin/admins')
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @RequirePermission('admins.manage')
  @Get()
  @ApiOperation({ summary: 'Danh sách quản trị viên, vai trò và trạng thái 2FA' })
  list(@CurrentAdmin() admin: AdminContext, @ZodQuery(adminAccountListSchema) query: AdminAccountListQuery): Promise<AdminAccountList> {
    return this.accounts.list(admin, query);
  }

  @RequirePermission('admins.manage')
  @Post()
  @ApiOperation({ summary: 'Tạo quản trị viên (trả mật khẩu tạm 1 lần, cần mã 2FA `otp`)' })
  create(@CurrentAdmin() admin: AdminContext, @ZodBody(createAdminSchema) body: CreateAdminInput, @Req() req: Request): Promise<AdminTemporaryPassword> {
    return this.accounts.create(admin, body, req);
  }

  @RequirePermission('admins.manage')
  @Post(':id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi vai trò quản trị (thu hồi mọi phiên của người đó, cần mã 2FA `otp`)' })
  changeRole(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(changeAdminRoleSchema) body: ChangeAdminRoleInput, @Req() req: Request): Promise<AdminAccountItem> {
    return this.accounts.changeRole(admin, id, body, req);
  }

  @RequirePermission('admins.manage')
  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Khoá quản trị viên (đăng xuất mọi thiết bị, cần mã 2FA `otp`)' })
  lock(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(lockAdminSchema) body: LockAdminInput, @Req() req: Request): Promise<AdminAccountItem> {
    return this.accounts.lock(admin, id, body, req);
  }

  @RequirePermission('admins.manage')
  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mở khoá quản trị viên' })
  unlock(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @Req() req: Request): Promise<AdminAccountItem> {
    return this.accounts.unlock(admin, id, req);
  }

  @RequirePermission('admins.manage')
  @Post(':id/reset-mfa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại 2FA (lần đăng nhập sau phải quét QR lại, cần mã 2FA `otp`)' })
  resetMfa(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(adminStepUpSchema) body: AdminStepUpInput, @Req() req: Request): Promise<AdminAccountItem> {
    return this.accounts.resetMfa(admin, id, body, req);
  }

  @RequirePermission('admins.manage')
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp mật khẩu tạm mới (hiện 1 lần, thu hồi mọi phiên, cần mã 2FA `otp`)' })
  resetPassword(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(adminStepUpSchema) body: AdminStepUpInput, @Req() req: Request): Promise<AdminTemporaryPassword> {
    return this.accounts.resetPassword(admin, id, body, req);
  }
}
