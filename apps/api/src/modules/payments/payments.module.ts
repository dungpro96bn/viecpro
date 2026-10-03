import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { EmployerContext } from '../employer-portal/employer-context.service.js';
import { PaymentsController } from './payments.controller.js';
import { MockPaymentProvider } from './payment-provider.js';
import { PaymentsService } from './payments.service.js';
import { PaymentExpiryWorker } from './payment-expiry.worker.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [EmployerContext, PaymentsService, PaymentExpiryWorker, { provide: MockPaymentProvider, inject: [ENV], useFactory: (env: Env) => {
    if (env.PAYMENT_PROVIDER !== 'mock') throw new Error('PAYMENT_PROVIDER=payos chưa được tích hợp; chưa thể xử lý thanh toán thật');
    return new MockPaymentProvider(env.PAYMENT_MOCK_SECRET, env.WEB_BASE_URL);
  } }],
  exports: [PaymentsService],
})
export class PaymentsModule {}
