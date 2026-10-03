import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { employerRangeSchema, employerReportQuerySchema, type EmployerAccount, type EmployerDashboard, type EmployerPartnerItem, type EmployerRangeQuery, type EmployerReport, type EmployerReportQuery, type TeamMember } from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodQuery } from '../../core/http/zod.js';
import { EmployerAccountService } from './employer-account.service.js';
import { EmployerDashboardService } from './employer-dashboard.service.js';
import { EmployerJobFormService } from './employer-job-form.service.js';
import { EmployerPartnersService } from './employer-partners.service.js';

@ApiTags('Nhà tuyển dụng – quản lý')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer')
export class EmployerAccountController {
  constructor(
    private readonly account: EmployerAccountService,
    private readonly dashboardService: EmployerDashboardService,
    private readonly partnersService: EmployerPartnersService,
    private readonly jobForm: EmployerJobFormService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Tài khoản NTD: doanh nghiệp / cá nhân, gói dịch vụ, số trên menu' })
  me(@CurrentUser() user: AuthPayload): Promise<EmployerAccount> {
    return this.account.account(user.sub);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Tổng quan: chỉ số, biểu đồ hồ sơ theo ngày, phễu, hồ sơ mới, lịch hôm nay' })
  dashboard(@CurrentUser() user: AuthPayload, @ZodQuery(employerRangeSchema) query: EmployerRangeQuery): Promise<EmployerDashboard> {
    return this.dashboardService.dashboard(user.sub, query.range);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Báo cáo lượt xem, hồ sơ, nguồn ứng tuyển và hiệu quả từng tin' })
  reports(@CurrentUser() user: AuthPayload, @ZodQuery(employerReportQuerySchema) query: EmployerReportQuery): Promise<EmployerReport> {
    return this.dashboardService.report(user.sub, query.range);
  }

  @Get('team')
  @ApiOperation({ summary: 'Cán bộ cùng doanh nghiệp (chọn người phụ trách, người phỏng vấn)' })
  team(@CurrentUser() user: AuthPayload): Promise<TeamMember[]> {
    return this.jobForm.team(user.sub);
  }

  @Get('partners')
  @ApiOperation({ summary: 'Doanh nghiệp phái cử của NTD cá nhân' })
  partners(@CurrentUser() user: AuthPayload): Promise<EmployerPartnerItem[]> {
    return this.partnersService.list(user.sub);
  }

  @Post('partners/:id/renew')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Gửi yêu cầu gia hạn liên kết với doanh nghiệp phái cử' })
  async renew(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.partnersService.requestRenewal(user.sub, id);
  }
}
