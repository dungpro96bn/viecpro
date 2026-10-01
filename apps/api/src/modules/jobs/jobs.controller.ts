import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  jobSearchSchema,
  paginationSchema,
  type JobDetail,
  type JobFacets,
  type JobListItem,
  type JobSearchQuery,
  type Paginated,
  type PaginationQuery,
  type RegionDirectoryItem,
} from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Public, Roles } from '../../core/auth/auth.decorators.js';
import { ZodQuery } from '../../core/http/zod.js';
import { JobsService } from './jobs.service.js';

@ApiTags('Việc làm')
@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Public()
  @Get('jobs')
  @ApiOperation({ summary: 'Tìm kiếm việc làm (trang chủ, /tim-kiem, danh sách đơn của NTD)' })
  search(@ZodQuery(jobSearchSchema) query: JobSearchQuery, @CurrentUser() user?: AuthPayload): Promise<Paginated<JobListItem>> {
    return this.jobs.search(query, user?.sub);
  }

  @Public()
  @Get('jobs/facets')
  @ApiOperation({ summary: 'Số đơn theo chương trình / vùng / ngành / đặc điểm (bộ lọc)' })
  facets(): Promise<JobFacets> {
    return this.jobs.facets();
  }

  @Roles('seeker')
  @Get('jobs/recommended')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Việc làm phù hợp nhất với hồ sơ (có % phù hợp)' })
  recommended(@CurrentUser() user: AuthPayload, @ZodQuery(paginationSchema) query: PaginationQuery): Promise<Paginated<JobListItem>> {
    return this.jobs.recommended(user.sub, query);
  }

  @Public()
  @Get('jobs/:slug')
  @ApiOperation({ summary: 'Chi tiết đơn hàng' })
  detail(@Param('slug') slug: string, @CurrentUser() user?: AuthPayload): Promise<JobDetail> {
    return this.jobs.getBySlug(slug, user?.sub);
  }

  @Public()
  @Get('jobs/:slug/similar')
  @ApiOperation({ summary: 'Đơn hàng tương tự (slider)' })
  similar(@Param('slug') slug: string): Promise<JobListItem[]> {
    return this.jobs.similar(slug);
  }

  @Public()
  @Get('regions')
  @ApiOperation({ summary: 'Danh bạ tỉnh thành theo vùng, kèm số đơn' })
  regions(): Promise<RegionDirectoryItem[]> {
    return this.jobs.regionDirectory();
  }
}
