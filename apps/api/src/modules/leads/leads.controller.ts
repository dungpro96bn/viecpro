import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { consultSchema, subscribeSchema, type ConsultInput, type SubscribeInput } from '@viecpro/shared';
import { Public } from '../../core/auth/auth.decorators.js';
import { ZodBody } from '../../core/http/zod.js';
import { LeadsService } from './leads.service.js';

/** Form công khai: "Đăng ký tư vấn miễn phí" và "Nhận đơn hàng mới mỗi tuần" */
@ApiTags('Tư vấn & nhận tin')
@Public()
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post('consultations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đăng ký tư vấn (trang hồ sơ NTD / tư vấn viên / chi tiết đơn)' })
  async consult(@ZodBody(consultSchema) body: ConsultInput) {
    await this.leads.consult(body);
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Nhận đơn hàng mới qua email / Zalo' })
  async subscribe(@ZodBody(subscribeSchema) body: SubscribeInput) {
    await this.leads.subscribe(body);
  }
}
