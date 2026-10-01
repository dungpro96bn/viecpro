import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { paginationSchema, verificationDecisionSchema, type PaginationQuery, type VerificationDecisionInput } from '@viecpro/shared';
import type { Request } from 'express';
import { ZodBody, ZodQuery } from '../../../core/http/zod.js';
import { AdminController, type AdminContext, RequirePermission } from '../admin-access.js';
import { CurrentAdmin } from '../current-admin.decorator.js';
import { VerificationsService } from './verifications.service.js';

@ApiTags('Admin – xác minh doanh nghiệp')
@AdminController()
@Controller('admin/verifications')
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}

  @RequirePermission('employers.read')
  @Get()
  @ApiOperation({ summary: 'Hồ sơ xác minh đang chờ' })
  list(@ZodQuery(paginationSchema) query: PaginationQuery) {
    return this.verifications.queue(query.limit);
  }

  @RequirePermission('employers.verify')
  @Post(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xác minh doanh nghiệp / NTD cá nhân' })
  async approve(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(verificationDecisionSchema) body: VerificationDecisionInput, @Req() req: Request) {
    await this.verifications.approve(admin.id, id, body, req);
  }

  @RequirePermission('employers.verify')
  @Post(':id/request-info')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Yêu cầu bổ sung giấy tờ' })
  async requestInfo(@CurrentAdmin() admin: AdminContext, @Param('id') id: string, @ZodBody(verificationDecisionSchema) body: VerificationDecisionInput, @Req() req: Request) {
    await this.verifications.requestInfo(admin.id, id, body, req);
  }
}
