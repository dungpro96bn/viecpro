import { Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { paginationSchema, reportCreateSchema, type MyReportItem, type Paginated, type PaginationQuery, type ReportCreateInput, type ReportCreated } from '@viecpro/shared';
import type { Request } from 'express';
import { type AuthPayload, CurrentUser, Public, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Báo cáo vi phạm')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reports')
  @ApiOperation({ summary: 'Báo cáo tin / công ty / NTD cá nhân vi phạm (khách gửi được, có giới hạn tần suất)' })
  // TODO(decision): spec yêu cầu CAPTCHA (Turnstile) cho khách – cần khoá site key trước khi bật
  create(@ZodBody(reportCreateSchema) body: ReportCreateInput, @CurrentUser() user: AuthPayload | undefined, @Req() req: Request): Promise<ReportCreated> {
    // Admin không báo cáo qua kênh người dùng
    return this.reports.create(body, user && user.role !== 'admin' ? user.sub : undefined, req.ip);
  }

  @Roles('seeker', 'employer')
  @ApiBearerAuth()
  @Get('me/reports')
  @ApiOperation({ summary: 'Báo cáo vi phạm tôi đã gửi và kết quả' })
  mine(@CurrentUser() user: AuthPayload, @ZodQuery(paginationSchema) query: PaginationQuery): Promise<Paginated<MyReportItem>> {
    return this.reports.mine(user.sub, query);
  }
}
