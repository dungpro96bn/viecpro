import { ForbiddenException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PLAN_CATALOG, type PlanKey } from '@viecpro/shared';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { EmployerContext } from '../employer-portal/employer-context.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MockPaymentProvider, PaymentProvider } from './payment-provider.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  readonly provider: PaymentProvider;
  constructor(private readonly prisma: PrismaService, private readonly context: EmployerContext, private readonly notifications: NotificationsService, mock: MockPaymentProvider) { this.provider = mock; }

  async createOrder(userId: string, planKey: string) {
    const plan = PLAN_CATALOG[planKey as PlanKey];
    if (!plan || plan.key === 'free') throw new ApiException('VALIDATION_ERROR', 'Gói dịch vụ không hợp lệ');
    const actor = await this.context.resolve(userId);
    if (actor.employerId) {
      const member = await this.prisma.recruiter.findUnique({ where: { id: actor.recruiterId }, select: { companyAdmin: true } });
      if (!member?.companyAdmin) throw new ForbiddenException('Chỉ quản trị viên doanh nghiệp được mua gói');
      if (plan.audience === 'individual') throw new ApiException('VALIDATION_ERROR', 'Gói này dành cho NTD cá nhân');
    } else if (plan.audience === 'company') throw new ApiException('VALIDATION_ERROR', 'Gói này dành cho doanh nghiệp');
    const code = `VPP-${randomUUID().slice(0, 12).toUpperCase()}`;
    const order = await this.prisma.paymentOrder.create({ data: { code, employerId: actor.employerId, recruiterId: actor.employerId ? null : actor.recruiterId, createdById: userId, planKey, amountVnd: plan.priceVnd, provider: this.provider.key, expiresAt: new Date(Date.now() + 15 * 60_000) } });
    const checkout = await this.provider.createCheckout({ code, amountVnd: plan.priceVnd, description: `Thanh toán ${plan.name} ${code}`, returnUrl: `/quan-ly-tuyen-dung/goi-dich-vu?order=${code}` });
    await this.prisma.paymentOrder.update({ where: { id: order.id }, data: { providerRef: checkout.providerRef } });
    return { ...order, providerRef: checkout.providerRef, checkoutUrl: checkout.checkoutUrl };
  }

  async list(userId: string) {
    const actor = await this.context.resolve(userId);
    const where = actor.employerId ? { employerId: actor.employerId } : { recruiterId: actor.recruiterId };
    return this.prisma.paymentOrder.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async detail(userId: string, code: string) {
    const actor = await this.context.resolve(userId);
    const order = await this.prisma.paymentOrder.findFirst({ where: { code, ...(actor.employerId ? { employerId: actor.employerId } : { recruiterId: actor.recruiterId }) } });
    if (!order) throw ApiException.notFound('Không tìm thấy giao dịch');
    return order;
  }

  async webhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer) {
    let event: ReturnType<PaymentProvider['parseWebhook']>;
    try { event = this.provider.parseWebhook(headers, rawBody); } catch { throw new ApiException('UNAUTHORIZED', 'Chữ ký thanh toán không hợp lệ', HttpStatus.UNAUTHORIZED); }
    const order = await this.prisma.paymentOrder.findFirst({ where: { providerRef: event.providerRef } });
    if (!order) throw ApiException.notFound('Không tìm thấy đơn thanh toán');
    if (order.status !== 'pending') return { ok: true, duplicate: true };
    if (order.expiresAt <= new Date()) {
      await this.prisma.paymentOrder.updateMany({ where: { id: order.id, status: 'pending' }, data: { status: 'expired' } });
      return { ok: true, expired: true };
    }
    if (event.amountVnd !== order.amountVnd) {
      await this.prisma.paymentOrder.updateMany({ where: { id: order.id, status: 'pending' }, data: { status: 'failed' } });
      return { ok: true, amountMismatch: true };
    }
    if (event.status === 'failed') {
      await this.prisma.paymentOrder.updateMany({ where: { id: order.id, status: 'pending' }, data: { status: 'failed' } });
      return { ok: true };
    }
    const plan = PLAN_CATALOG[order.planKey as PlanKey];
    if (!plan) throw new Error(`Unknown plan ${order.planKey}`);
    const expiry = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.paymentOrder.updateMany({ where: { id: order.id, status: 'pending' }, data: { status: 'paid', paidAt: new Date() } });
      if (!claim.count) return null;
      const where = order.employerId ? { employerId: order.employerId } : { recruiterId: order.recruiterId! };
      const before = await tx.businessPlan.findFirst({ where });
      const start = before && before.expiresAt > new Date() ? before.expiresAt : new Date();
      const after = { name: plan.name, jobQuota: plan.jobQuota, boostQuota: plan.boostQuota, boostsUsed: 0, expiresAt: new Date(start.getTime() + plan.durationDays * 86400_000) };
      if (before) await tx.businessPlan.update({ where: { id: before.id }, data: after });
      else await tx.businessPlan.create({ data: { ...where, ...after } });
      await tx.paymentOrder.update({ where: { id: order.id }, data: {
        planBefore: before ? { name: before.name, jobQuota: before.jobQuota, boostQuota: before.boostQuota, boostsUsed: before.boostsUsed, expiresAt: before.expiresAt.toISOString() } : undefined,
        planAfter: { ...after, expiresAt: after.expiresAt.toISOString() },
      } });
      return after.expiresAt;
    });
    if (expiry) await this.notifications.notify(order.createdById, 'billing.activated', { title: `${plan.name} đã được kích hoạt`, body: `Gói dịch vụ có hiệu lực đến ${expiry.toLocaleDateString('vi-VN')}.`, link: '/quan-ly-tuyen-dung/goi-dich-vu' }).catch((e: unknown) => this.logger.warn(`Không gửi được thông báo kích hoạt gói: ${String(e)}`));
    return { ok: true };
  }

  async mockSettle(providerRef: string, status: 'paid' | 'failed') {
    if (process.env.NODE_ENV === 'production') throw ApiException.forbidden('Thanh toán mô phỏng đã tắt');
    const order = await this.prisma.paymentOrder.findFirst({ where: { providerRef } });
    if (!order) throw ApiException.notFound('Không tìm thấy đơn thanh toán');
    const payload = { providerRef, status, amountVnd: order.amountVnd };
    const raw = Buffer.from(JSON.stringify(payload));
    return this.webhook({ 'x-payment-signature': (this.provider as MockPaymentProvider).sign(payload) }, raw);
  }

  async adminList() {
    return this.prisma.paymentOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async adminCsv() {
    const rows = await this.adminList();
    const cell = (value: string | number | Date | null) => `"${String(value instanceof Date ? value.toISOString() : value ?? '').replaceAll('"', '""')}"`;
    return ['Mã,Gói,Số tiền,Trạng thái,Cổng,Doanh nghiệp,NTD cá nhân,Ngày tạo', ...rows.map((o) => [o.code, o.planKey, o.amountVnd, o.status, o.provider, o.employerId, o.recruiterId, o.createdAt].map(cell).join(','))].join('\r\n');
  }
}
