import { Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  employerJobListSchema,
  jobMarketSchema,
  jobUpsertSchema,
  type EmployerJobForm,
  type EmployerJobItem,
  type EmployerJobList,
  type EmployerJobListQuery,
  type EmployerJobStats,
  type EmployerJobSummary,
  type JobDetail,
  type JobMarketInsight,
  type JobMarketQuery,
  type JobUpsertInput,
} from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { EmployerJobFormService } from './employer-job-form.service.js';
import { EmployerJobTrashService } from './employer-job-trash.service.js';
import { EmployerJobsService } from './employer-jobs.service.js';

@ApiTags('Nhà tuyển dụng – quản lý')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer/jobs')
export class EmployerJobsController {
  constructor(
    private readonly jobs: EmployerJobsService,
    private readonly form: EmployerJobFormService,
    private readonly trash: EmployerJobTrashService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Tin tuyển dụng theo tab (đang hiển thị / chờ duyệt / nháp / hết hạn) kèm số hồ sơ' })
  list(@CurrentUser() user: AuthPayload, @ZodQuery(employerJobListSchema) query: EmployerJobListQuery): Promise<EmployerJobList> {
    return this.jobs.list(user.sub, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Chỉ số trang tin tuyển dụng: lượt xem, chuyển đổi, chỉ tiêu, nguồn hồ sơ, hoạt động gần đây' })
  summary(@CurrentUser() user: AuthPayload): Promise<EmployerJobSummary> {
    return this.jobs.summary(user.sub);
  }

  @Get('market')
  @ApiOperation({ summary: 'Khoảng lương tin cùng ngành / tỉnh, người lao động phù hợp, hồ sơ dự kiến (form đăng tin)' })
  market(@CurrentUser() user: AuthPayload, @ZodQuery(jobMarketSchema) query: JobMarketQuery): Promise<JobMarketInsight> {
    return this.form.market(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Đăng tin (đã xác minh → hiển thị ngay; chưa xác minh → chờ duyệt) hoặc lưu nháp' })
  create(@CurrentUser() user: AuthPayload, @ZodBody(jobUpsertSchema) body: JobUpsertInput): Promise<JobDetail> {
    return this.form.create(user.sub, body);
  }

  @Get(':id/form')
  @ApiOperation({ summary: 'Dữ liệu form để sửa tin' })
  getForm(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerJobForm> {
    return this.form.getForm(user.sub, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Sửa tin (NTD chưa xác minh → chờ duyệt lại)' })
  update(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(jobUpsertSchema) body: JobUpsertInput): Promise<JobDetail> {
    return this.form.update(user.sub, id, body);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Số liệu một tin: hồ sơ 7 ngày qua, tỉ lệ chuyển đổi, gợi ý tối ưu' })
  stats(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerJobStats> {
    return this.jobs.stats(user.sub, id);
  }

  @Post(':id/boost')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đẩy tin lên đầu (trừ 1 lượt đẩy tin của gói)' })
  boost(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerJobItem> {
    return this.jobs.boost(user.sub, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạm ẩn tin đang hiển thị' })
  pause(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerJobItem> {
    return this.jobs.pause(user.sub, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mở lại tin tạm ẩn (NTD chưa xác minh phải chờ duyệt lại)' })
  resume(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerJobItem> {
    return this.jobs.resume(user.sub, id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đóng tin (hết hạn / đủ chỉ tiêu)' })
  close(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerJobItem> {
    return this.jobs.close(user.sub, id);
  }

  @Post(':id/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá tin vào Thùng rác (chỉ tin nháp / bị từ chối / đã đóng; khôi phục được trong 30 ngày)' })
  async remove(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.trash.remove(user.sub, id);
  }
}
