import { Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthPayload, CurrentUser, Public, Roles } from '../../core/auth/auth.decorators.js';
import { PaymentsService } from './payments.service.js';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodBody } from '../../core/http/zod.js';

const orderSchema = z.object({ planKey: z.string().min(1).max(40) });
const mockSettlementSchema = z.object({ providerRef: z.string().min(1), status: z.enum(['paid', 'failed']) });

@ApiTags('Thanh toán')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post('payments/webhook/mock')
  @ApiOperation({ summary: 'Webhook thanh toán mock đã ký HMAC' })
  webhook(@Headers() headers: Record<string, string | string[] | undefined>, @Req() req: Request & { rawBody?: Buffer }) {
    return this.payments.webhook(headers, req.rawBody ?? Buffer.from(JSON.stringify(req.body)));
  }

  @Public()
  @Post('payments/mock/settle')
  settleMock(@ZodBody(mockSettlementSchema) body: z.infer<typeof mockSettlementSchema>) { return this.payments.mockSettle(body.providerRef, body.status); }

  @ApiBearerAuth()
  @Roles('employer')
  @Post('employer/billing/orders')
  create(@CurrentUser() user: AuthPayload, @ZodBody(orderSchema) body: z.infer<typeof orderSchema>) { return this.payments.createOrder(user.sub, body.planKey); }

  @ApiBearerAuth()
  @Roles('employer')
  @Get('employer/billing/orders')
  list(@CurrentUser() user: AuthPayload) { return this.payments.list(user.sub); }

  @ApiBearerAuth()
  @Roles('employer')
  @Get('employer/billing/orders/:code')
  detail(@CurrentUser() user: AuthPayload, @Param('code') code: string) { return this.payments.detail(user.sub, code); }
}
