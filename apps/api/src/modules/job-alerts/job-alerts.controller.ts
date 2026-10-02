import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  jobAlertSchema,
  jobAlertUpdateSchema,
  paginationSchema,
  type AlertFeedItem,
  type JobAlertInput,
  type JobAlertItem,
  type JobAlertList,
  type JobAlertSuggestion,
  type JobAlertUpdateInput,
  type JobListItem,
  type Paginated,
  type PaginationQuery,
} from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { JobAlertsService } from './job-alerts.service.js';

@ApiTags('Thông báo việc làm')
@ApiBearerAuth()
@Roles('seeker')
@Controller('me/alerts')
export class JobAlertsController {
  constructor(private readonly alerts: JobAlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo việc làm + số việc mới chưa xem' })
  list(@CurrentUser() user: AuthPayload): Promise<JobAlertList> {
    return this.alerts.list(user.sub);
  }

  @Get('feed')
  @ApiOperation({ summary: '"Việc mới cho bạn": việc khớp các thông báo đang bật (có % phù hợp)' })
  feed(@CurrentUser() user: AuthPayload): Promise<AlertFeedItem[]> {
    return this.alerts.feed(user.sub);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Gợi ý tạo thông báo từ hồ sơ' })
  suggestions(@CurrentUser() user: AuthPayload): Promise<JobAlertSuggestion[]> {
    return this.alerts.suggestions(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo thông báo việc làm (tối đa 10)' })
  create(@CurrentUser() user: AuthPayload, @ZodBody(jobAlertSchema) body: JobAlertInput): Promise<JobAlertItem> {
    return this.alerts.create(user.sub, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa / bật / tắt thông báo việc làm' })
  update(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(jobAlertUpdateSchema) body: JobAlertUpdateInput): Promise<JobAlertItem> {
    return this.alerts.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá thông báo việc làm' })
  async remove(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.alerts.remove(user.sub, id);
  }

  @Get(':id/jobs')
  @ApiOperation({ summary: 'Việc khớp tiêu chí (Xem chi tiết) – đánh dấu đã xem' })
  jobs(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodQuery(paginationSchema) query: PaginationQuery): Promise<Paginated<JobListItem> & { newSince: string }> {
    return this.alerts.jobs(user.sub, id, query);
  }

  @Post(':id/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đánh dấu đã xem việc mới của thông báo' })
  async seen(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.alerts.markSeen(user.sub, id);
  }
}
