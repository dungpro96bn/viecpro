import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { paginationSchema, type PaginationQuery } from '@viecpro/shared';
import { type AuthPayload, CurrentUser } from '../../core/auth/auth.decorators.js';
import { ZodQuery } from '../../core/http/zod.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Thông báo')
@ApiBearerAuth()
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo + số chưa đọc' })
  list(@CurrentUser() user: AuthPayload, @ZodQuery(paginationSchema) query: PaginationQuery) {
    return this.notifications.list(user.sub, query);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đánh dấu đã đọc tất cả' })
  async readAll(@CurrentUser() user: AuthPayload) {
    await this.notifications.markRead(user.sub);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đánh dấu một thông báo đã đọc' })
  async read(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.notifications.markRead(user.sub, id);
  }
}
