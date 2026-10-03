import { Controller, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminExportSchema,
  adminJobUpdateSchema,
  adminManageJobsQuerySchema,
  homepageContentSchema,
  systemSettingsSchema,
  type AdminExportInput,
  type AdminJobUpdateInput,
  type AdminManageJobsQuery,
  type HomepageContent,
  type SystemSettings,
} from '@viecpro/shared';
import type { Request, Response } from 'express';
import { Public } from '../../core/auth/auth.decorators.js';
import { CurrentAdmin } from './current-admin.decorator.js';
import { AdminController, RequirePermission, type AdminContext } from './admin-access.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { AdminToolsService } from './admin-tools.service.js';

@ApiTags('Quản trị – công cụ hệ thống')
@ApiBearerAuth()
@AdminController()
@Controller('admin/tools')
export class AdminToolsController {
  constructor(private readonly tools: AdminToolsService) {}

  @Get('jobs')
  @RequirePermission('jobs.manage')
  @ApiOperation({ summary: 'Danh sách tin để sửa thay nhà tuyển dụng' })
  jobs(@ZodQuery(adminManageJobsQuerySchema) query: AdminManageJobsQuery) {
    return this.tools.jobs(query);
  }

  @Get('jobs/:id')
  @RequirePermission('jobs.manage')
  @ApiOperation({ summary: 'Chi tiết tin được phép chỉnh sửa' })
  job(@Param('id') id: string) {
    return this.tools.job(id);
  }

  @Patch('jobs/:id')
  @RequirePermission('jobs.manage')
  @ApiOperation({ summary: 'Sửa nội dung tin thay nhà tuyển dụng, giữ nguyên trạng thái duyệt' })
  updateJob(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(adminJobUpdateSchema) body: AdminJobUpdateInput, @Req() req: Request) {
    return this.tools.updateJob(admin, id, body, req);
  }

  @Get('system')
  @RequirePermission('settings.manage')
  @ApiOperation({ summary: 'Cài đặt hệ thống' })
  system() {
    return this.tools.getSystemSettings();
  }

  @Patch('system')
  @RequirePermission('settings.manage')
  @ApiOperation({ summary: 'Cập nhật thông tin hỗ trợ và chế độ bảo trì' })
  updateSystem(@CurrentAdmin() admin: AdminContext, @ZodBody(systemSettingsSchema) body: SystemSettings, @Req() req: Request) {
    return this.tools.updateSystemSettings(admin, body, req);
  }

  @Get('homepage')
  @RequirePermission('content.manage')
  @ApiOperation({ summary: 'Nội dung banner và quảng cáo trang chủ' })
  homepage() {
    return this.tools.getHomepageContent();
  }

  @Patch('homepage')
  @RequirePermission('content.manage')
  @ApiOperation({ summary: 'Cập nhật banner và quảng cáo trang chủ' })
  updateHomepage(@CurrentAdmin() admin: AdminContext, @ZodBody(homepageContentSchema) body: HomepageContent, @Req() req: Request) {
    return this.tools.updateHomepageContent(admin, body, req);
  }

  @Post('exports')
  @RequirePermission('data.export')
  @ApiOperation({ summary: 'Tạo link CSV dùng một lần, giới hạn 10.000 dòng' })
  createExport(@CurrentAdmin() admin: AdminContext, @ZodBody(adminExportSchema) body: AdminExportInput, @Req() req: Request) {
    return this.tools.createExport(admin, body, req);
  }
}

@ApiTags('Quản trị – tải dữ liệu')
@Controller('admin/exports')
export class AdminExportDownloadController {
  constructor(private readonly tools: AdminToolsService) {}

  @Get('download/:token')
  @Public()
  @ApiOperation({ summary: 'Tải CSV bằng link bảo mật dùng một lần' })
  async download(@Param('token') token: string, @Res() response: Response) {
    const result = await this.tools.consumeExport(token);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    response.send(result.csv);
  }
}
