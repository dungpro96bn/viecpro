import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { paginationSchema, type LeadItem, type Paginated, type PaginationQuery } from '@viecpro/shared';
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
  @ApiOperation({ summary: 'Khách đăng ký tư vấn' })
  leads(@CurrentUser() user: AuthPayload, @ZodQuery(paginationSchema) query: PaginationQuery): Promise<Paginated<LeadItem>> {
    return this.portal.listLeads(user.sub, query);
  }
}
