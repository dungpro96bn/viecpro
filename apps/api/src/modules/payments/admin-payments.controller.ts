import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminController, RequirePermission } from '../admin/admin-access.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('Admin – giao dịch')
@AdminController()
@Controller('admin/billing/orders')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @RequirePermission('billing.read')
  @Get()
  @ApiOperation({ summary: 'Danh sách giao dịch thanh toán' })
  list() { return this.payments.adminList(); }

  @RequirePermission('data.export')
  @Get('export')
  @ApiOperation({ summary: 'Xuất giao dịch dạng CSV' })
  async export(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="viecpro-transactions.csv"');
    res.send(`\uFEFF${await this.payments.adminCsv()}`);
  }
}
