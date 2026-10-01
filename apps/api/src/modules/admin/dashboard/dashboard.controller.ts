import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { dashboardQuerySchema, type AdminBadges, type AdminDashboard, type DashboardQuery } from '@viecpro/shared';
import type { Request, Response } from 'express';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ZodQuery } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, AnyAdmin, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { csvCell } from './insights.js';

const RANGE_LABEL = { today: 'Hôm nay', '7d': '7 ngày', '30d': '30 ngày', quarter: 'Quý' } as const;

@ApiTags('Admin – bảng điều khiển')
@AdminController()
@Controller('admin')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly audit: AuditService,
  ) {}

  @AnyAdmin()
  @Get('badges')
  @ApiOperation({ summary: 'Số việc tồn trên menu: tin chờ duyệt, hồ sơ xác minh, báo cáo vi phạm' })
  badges(): Promise<AdminBadges> {
    return this.dashboard.badges();
  }

  @RequirePermission('dashboard.read')
  @Get('dashboard')
  @ApiOperation({ summary: 'Số liệu bảng điều khiển theo khoảng thời gian' })
  get(@ZodQuery(dashboardQuerySchema) query: DashboardQuery): Promise<AdminDashboard> {
    return this.dashboard.dashboard(query.range);
  }

  @RequirePermission('data.export')
  @Get('dashboard/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Xuất báo cáo tổng quan (CSV) – có ghi nhật ký' })
  async export(
    @ZodQuery(dashboardQuerySchema) query: DashboardQuery,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const d = await this.dashboard.dashboard(query.range);
    await this.audit.log({ actorId: admin.id, action: 'data.export', targetType: 'dashboard', after: { range: query.range } }, req);

    const rows: Array<Array<string | number | null>> = [
      ['Báo cáo tổng quan viecpro', RANGE_LABEL[query.range], d.generatedAt],
      [],
      ['Chỉ số', 'Giá trị', 'Thay đổi', 'Ghi chú'],
      ...d.kpis.map((k) => [k.label, k.value, k.delta, k.note]),
      [],
      ['Ngày', 'Hồ sơ ứng tuyển'],
      ...d.applicationsDaily.days.map((x) => [x.date, x.count]),
      [],
      ['Tỉnh', 'Chỉ tiêu đang mở'],
      ...d.demandByPref.map((x) => [x.pref, x.quota]),
    ];
    res.setHeader('Content-Disposition', `attachment; filename="viecpro-tong-quan-${new Date().toISOString().slice(0, 10)}.csv"`);
    // BOM để Excel đọc đúng tiếng Việt
    return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
}

