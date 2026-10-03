import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service.js';

@Injectable()
export class PaymentExpiryWorker implements OnModuleInit {
  private readonly logger = new Logger(PaymentExpiryWorker.name);
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() {
    const timer = setInterval(() => { void this.expire().catch((e: unknown) => this.logger.error('Không thể hết hạn đơn thanh toán', e)); }, 60_000);
    timer.unref();
    void this.expire().catch((e: unknown) => this.logger.error('Không thể hết hạn đơn thanh toán', e));
  }
  private expire() {
    return this.prisma.paymentOrder.updateMany({ where: { status: 'pending', expiresAt: { lte: new Date() } }, data: { status: 'expired' } });
  }
}
