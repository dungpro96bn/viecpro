import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { savedJobListSchema, type SavedJobList, type SavedJobListQuery, type SavedJobState } from '@viecpro/shared';
import { type AuthPayload, CurrentUser } from '../../core/auth/auth.decorators.js';
import { ZodQuery } from '../../core/http/zod.js';
import { SavedJobsService } from './saved-jobs.service.js';

/** Nút "Lưu việc" (trái tim) trên thẻ đơn hàng */
@ApiTags('Việc đã lưu')
@ApiBearerAuth()
@Controller('me/saved-jobs')
export class SavedJobsController {
  constructor(private readonly savedJobs: SavedJobsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách việc đã lưu (sắp xếp, lọc ngành) + % phù hợp, điều kiện so với hồ sơ' })
  list(@CurrentUser() user: AuthPayload, @ZodQuery(savedJobListSchema) query: SavedJobListQuery): Promise<SavedJobList> {
    return this.savedJobs.list(user.sub, query);
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Việc này đã lưu chưa (trang chi tiết đơn)' })
  state(@CurrentUser() user: AuthPayload, @Param('jobId') jobId: string): Promise<SavedJobState> {
    return this.savedJobs.state(user.sub, jobId);
  }

  @Put(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Lưu việc' })
  save(@CurrentUser() user: AuthPayload, @Param('jobId') jobId: string): Promise<void> {
    return this.savedJobs.save(user.sub, jobId);
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bỏ lưu việc' })
  unsave(@CurrentUser() user: AuthPayload, @Param('jobId') jobId: string): Promise<void> {
    return this.savedJobs.unsave(user.sub, jobId);
  }
}
