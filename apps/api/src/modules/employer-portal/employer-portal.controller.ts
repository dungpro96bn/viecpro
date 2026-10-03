import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { employerLeadListSchema, type EmployerLeadList, type EmployerLeadListQuery } from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodQuery } from '../../core/http/zod.js';
import { EmployerPortalService } from './employer-portal.service.js';

@ApiTags('Nhà tuyển dụng – quản lý')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer')
export class EmployerPortalController {
  constructor(private readonly portal: EmployerPortalService) {}

  @Get('leads')
  @ApiOperation({ summary: 'Khách đăng ký tư vấn (trang công ty, trang cán bộ, tin của NTD); lọc chưa / đã xử lý' })
  leads(@CurrentUser() user: AuthPayload, @ZodQuery(employerLeadListSchema) query: EmployerLeadListQuery): Promise<EmployerLeadList> {
    return this.portal.listLeads(user.sub, query);
  }

  @Post('leads/:id/handle')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đánh dấu đã liên hệ khách cần tư vấn' })
  async handleLead(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.portal.handleLead(user.sub, id);
  }
}
