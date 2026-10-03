import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ConfigModule } from '../src/config/config.module.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { AllExceptionsFilter } from '../src/core/http/all-exceptions.filter.js';
import { PrismaModule } from '../src/core/prisma/prisma.module.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { PaymentsModule } from '../src/modules/payments/payments.module.js';

const DB_URL = process.env.E2E_DATABASE_URL;
const SECRET = 'payments-e2e-secret-at-least-32-characters';
const id = 'pay-e2e';

describe.skipIf(!DB_URL)('Thanh toán gói – Postgres thật (e2e)', () => {
  let app: INestApplication; let jwt: JwtService; let prisma: PrismaService;
  beforeAll(async () => {
    Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: DB_URL, JWT_SECRET: SECRET, OTP_SECRET: 'e2e-otp-secret-with-at-least-32-characters!!', ADMIN_MFA_KEY: 'e2e-admin-mfa-key-with-at-least-32-chars!!', PAYMENT_PROVIDER: 'mock', PAYMENT_MOCK_SECRET: 'payments-mock-secret-at-least-32-characters', REDIS_URL: '' });
    const mod = await Test.createTestingModule({ imports: [ConfigModule, PrismaModule, JwtModule.register({ global: true, secret: SECRET }), PaymentsModule], providers: [AuthGuard] }).compile();
    app = mod.createNestApplication(); app.useGlobalGuards(mod.get(AuthGuard)); app.useGlobalFilters(new AllExceptionsFilter()); app.setGlobalPrefix('api/v1'); await app.init();
    jwt = mod.get(JwtService); prisma = mod.get(PrismaService);
    await prisma.paymentOrder.deleteMany({ where: { createdById: { startsWith: id } } });
    await prisma.businessPlan.deleteMany({ where: { recruiterId: { startsWith: id } } });
    await prisma.recruiter.deleteMany({ where: { id: { startsWith: id } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: id } } });
    await prisma.user.createMany({ data: [{ id: `${id}-solo`, role: 'employer', name: 'NTD cá nhân' }, { id: `${id}-other`, role: 'employer', name: 'NTD khác' }, { id: `${id}-member`, role: 'employer', name: 'Thành viên' }, { id: `${id}-seeker`, role: 'seeker', name: 'Ứng viên' }] });
    await prisma.employer.create({ data: { id: `${id}-company`, slug: `${id}-company`, name: 'Công ty test' } });
    await prisma.recruiter.createMany({ data: [{ id: `${id}-r-solo`, slug: `${id}-solo`, userId: `${id}-solo`, name: 'Solo', title: 'NTD' }, { id: `${id}-r-other`, slug: `${id}-other`, userId: `${id}-other`, name: 'Other', title: 'NTD' }, { id: `${id}-r-member`, slug: `${id}-member`, userId: `${id}-member`, name: 'Member', title: 'Cán bộ', employerId: `${id}-company`, companyAdmin: false }] });
  });
  afterAll(async () => { if (prisma) { await prisma.paymentOrder.deleteMany({ where: { createdById: { startsWith: id } } }); await prisma.businessPlan.deleteMany({ where: { recruiterId: { startsWith: id } } }); await prisma.recruiter.deleteMany({ where: { id: { startsWith: id } } }); await prisma.employer.deleteMany({ where: { id: `${id}-company` } }); await prisma.user.deleteMany({ where: { id: { startsWith: id } } }); } await app?.close(); });
  const auth = async (sub: string, role: 'employer' | 'seeker' = 'employer') => `Bearer ${await jwt.signAsync({ sub, role, sid: `${sub}-sid` })}`;
  it('401 / 403 mua gói và chặn thành viên thường', async () => {
    await request(app.getHttpServer()).post('/api/v1/employer/billing/orders').send({ planKey: 'pro' }).expect(401);
    await request(app.getHttpServer()).post('/api/v1/employer/billing/orders').set('Authorization', await auth(`${id}-seeker`, 'seeker')).send({ planKey: 'pro' }).expect(403);
    await request(app.getHttpServer()).post('/api/v1/employer/billing/orders').set('Authorization', await auth(`${id}-member`)).send({ planKey: 'pro' }).expect(403);
  });
  it('giá lấy từ server; webhook sai chữ ký không kích hoạt; thanh toán lặp chỉ cộng gói một lần', async () => {
    const token = await auth(`${id}-solo`);
    const created = await request(app.getHttpServer()).post('/api/v1/employer/billing/orders').set('Authorization', token).send({ planKey: 'ca_nhan_plus', amountVnd: 1 }).expect(201);
    expect(created.body.amountVnd).toBe(299000);
    await request(app.getHttpServer()).get(`/api/v1/employer/billing/orders/${created.body.code}`).set('Authorization', await auth(`${id}-other`)).expect(404);
    const payload = { providerRef: created.body.providerRef, status: 'paid', amountVnd: 299000 };
    const raw = Buffer.from(JSON.stringify(payload));
    await request(app.getHttpServer()).post('/api/v1/payments/webhook/mock').set('x-payment-signature', '0'.repeat(64)).send(payload).expect(401);
    expect(await prisma.businessPlan.findUnique({ where: { recruiterId: `${id}-r-solo` } })).toBeNull();
    const signature = (await import('node:crypto')).createHmac('sha256', 'payments-mock-secret-at-least-32-characters').update(raw).digest('hex');
    await request(app.getHttpServer()).post('/api/v1/payments/webhook/mock').set('x-payment-signature', signature).send(payload).expect(201);
    await request(app.getHttpServer()).post('/api/v1/payments/webhook/mock').set('x-payment-signature', signature).send(payload).expect(201);
    const plan = await prisma.businessPlan.findUniqueOrThrow({ where: { recruiterId: `${id}-r-solo` } });
    expect(plan).toMatchObject({ name: 'Cá nhân Plus', jobQuota: 10, boostQuota: 10 });
    expect(await prisma.paymentOrder.count({ where: { code: created.body.code, status: 'paid' } })).toBe(1);
    const mismatch = await request(app.getHttpServer()).post('/api/v1/employer/billing/orders').set('Authorization', token).send({ planKey: 'pro' }).expect(201);
    const wrongAmount = { providerRef: mismatch.body.providerRef, status: 'paid', amountVnd: 1 };
    const wrongRaw = Buffer.from(JSON.stringify(wrongAmount));
    const wrongSignature = (await import('node:crypto')).createHmac('sha256', 'payments-mock-secret-at-least-32-characters').update(wrongRaw).digest('hex');
    await request(app.getHttpServer()).post('/api/v1/payments/webhook/mock').set('x-payment-signature', wrongSignature).send(wrongAmount).expect(201);
    expect(await prisma.paymentOrder.findUniqueOrThrow({ where: { code: mismatch.body.code } })).toMatchObject({ status: 'failed' });
  });
});
