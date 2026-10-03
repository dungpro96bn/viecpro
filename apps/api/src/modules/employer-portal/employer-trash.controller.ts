import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { purgeSchema, trashListSchema, type Paginated, type PurgeInput, type TrashedJob, type TrashedMember, type TrashListQuery, type TrashSummary } from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { EmployerTrashService } from './employer-trash.service.js';

@ApiTags('Nhà tuyển dụng – thùng rác')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer/trash')
export class EmployerTrashController {
  constructor(private readonly trash: EmployerTrashService) {}

  @Get()
  @ApiOperation({ summary: 'Thùng rác: số mục xoá mềm theo từng loại (quản trị viên doanh nghiệp)' })
  summary(@CurrentUser() user: AuthPayload): Promise<TrashSummary> {
    return this.trash.summary(user.sub);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Tin tuyển dụng đã xoá – khôi phục hoặc xoá vĩnh viễn' })
  jobs(@CurrentUser() user: AuthPayload, @ZodQuery(trashListSchema) query: TrashListQuery): Promise<Paginated<TrashedJob>> {
    return this.trash.jobs(user.sub, query);
  }

  @Post('jobs/:id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Khôi phục tin đã xoá (giữ nguyên trạng thái lúc xoá, không tự hiển thị)' })
  async restoreJob(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.trash.restoreJob(user.sub, id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('jobs/:id/purge')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá vĩnh viễn tin (gõ lại mã tin): hồ sơ ứng tuyển vẫn giữ, không khôi phục được' })
  async purgeJob(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(purgeSchema) body: PurgeInput) {
    await this.trash.purgeJob(user.sub, id, body);
  }

  @Get('members')
  @ApiOperation({ summary: 'Thành viên đã xoá – khôi phục hoặc xoá vĩnh viễn' })
  members(@CurrentUser() user: AuthPayload, @ZodQuery(trashListSchema) query: TrashListQuery): Promise<Paginated<TrashedMember>> {
    return this.trash.members(user.sub, query);
  }

  @Post('members/:id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Khôi phục thành viên đã xoá (đăng nhập lại được, quyền thành viên thường)' })
  async restore(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.trash.restoreMember(user.sub, id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('members/:id/purge')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá vĩnh viễn (gõ lại tên để xác nhận): ẩn danh hồ sơ + tài khoản, không khôi phục được' })
  async purge(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(purgeSchema) body: PurgeInput) {
    await this.trash.purgeMember(user.sub, id, body);
  }
}
