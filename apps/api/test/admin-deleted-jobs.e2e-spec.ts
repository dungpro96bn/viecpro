import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ADMIN_PERMISSIONS, type ModerationList } from '@viecpro/shared';
import request from 'supertest';
import { ConfigModule } from '../src/config/config.module.js';
import { AssetsModule } from '../src/core/assets/assets.module.js';
import { AuditModule } from '../src/core/audit/audit.service.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { AllExceptionsFilter } from '../src/core/http/all-exceptions.filter.js';
import { MailModule } from '../src/core/mail/mail.module.js';
import { PrismaModule } from '../src/core/prisma/prisma.module.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { AdminModule } from '../src/modules/admin/admin.module.js';
import { NotificationsModule } from '../src/modules/notifications/notifications.module.js';

/** Admin thấy tin NTD đã xoá có nhãn, không sửa thay được, tab "Yêu cầu sửa" không còn tin đã xoá – Postgres thật (`npm run test:e2e:db`) */
const DB_URL = process.env.E2E_DATABASE_URL;
const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';
const PREFIX = 'adj-e2e';

describe.skipIf(!DB_URL)('Admin – tin nhà tuyển dụng đã xoá (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth = '';
  const ids = { live: `${PREFIX}-live`, trash: `${PREFIX}-trash`, purged: `${PREFIX}-purged` };

  async function cleanup() {
    const admins = (await prisma.user.findMany({ where: { email: { endsWith: `@${PREFIX}` } }, select: { id: true } })).map((u) => u.id);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: admins } } });
    await prisma.job.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.recruiter.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${PREFIX}` } } });
    await prisma.adminRole.deleteMany({ where: { key: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: DB_URL,
      JWT_SECRET,
      OTP_SECRET: 'e2e-otp-secret-with-at-least-32-characters!!',
      ADMIN_MFA_KEY: 'e2e-admin-mfa-key-with-at-least-32-chars!!',
      ADMIN_MFA_BYPASS: 'true',
      JOB_ALERT_WORKER: 'false',
      REDIS_URL: '',
    });
    const module = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, AssetsModule, MailModule, AuditModule, NotificationsModule, JwtModule.register({ global: true, secret: JWT_SECRET }), AdminModule],
      providers: [AuthGuard],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(module.get(AuthGuard));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = module.get(PrismaService);
    await cleanup();

    const role = await prisma.adminRole.create({ data: { key: `${PREFIX}-all`, name: 'all', permissions: [...ADMIN_PERMISSIONS] } });
    const admin = await prisma.user.create({ data: { role: 'admin', name: 'Admin', email: `admin@${PREFIX}`, mfaEnabledAt: new Date(), adminRoleId: role.id } });
    const session = await prisma.session.create({ data: { userId: admin.id, refreshTokenHash: randomBytes(24).toString('hex'), isAdmin: true, expiresAt: new Date(Date.now() + 3600_000) } });
    auth = `Bearer ${await module.get(JwtService).signAsync({ sub: admin.id, role: 'admin', sid: session.id, adm: true })}`;

    await prisma.recruiter.create({ data: { id: `${PREFIX}-rec`, slug: `${PREFIX}-rec`, name: 'NTD', title: 'Cán bộ' } });
    const now = new Date();
    const job = (id: string, n: number, extra: object) => ({
      id,
      code: `VP-ADJ-${n}`,
      slug: `${PREFIX}-${n}`,
      title: `Tin kiểm thử ${n} cho admin`,
      searchText: `tin ${n}`,
      imageUrl: '/images/jobs/default.jpg',
      pref: 'Tokyo',
      region: 'kanto' as const,
      program: 'tts' as const,
      industry: 'Cơ khí',
      salary: 180_000,
      quantity: 5,
      gender: 'both' as const,
      birthYearFrom: 1990,
      birthYearTo: 2005,
      recruiterId: `${PREFIX}-rec`,
      // Bị yêu cầu sửa gần đây – trước khi sửa, cả 3 đều nằm ở tab "Yêu cầu sửa"
      status: 'rejected' as const,
      moderatedAt: now,
      changesRequestedAt: now,
      rejectReason: 'Bổ sung mô tả',
      ...extra,
    });
    await prisma.job.createMany({
      data: [job(ids.live, 1, {}), job(ids.trash, 2, { deletedAt: now }), job(ids.purged, 3, { deletedAt: now, purgedAt: now })],
    });
  });

  afterAll(async () => {
    if (prisma) await cleanup();
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const body = { title: 'Tiêu đề mới đủ dài cho tin', industry: 'Cơ khí', pref: 'Tokyo', salary: 190_000, quantity: 3, description: 'Mô tả mới' };

  it('không sửa thay được tin NTD đã xoá (409), tin còn hoạt động vẫn sửa được', async () => {
    const trash = await http().patch(`/api/v1/admin/tools/jobs/${ids.trash}`).set('Authorization', auth).send(body);
    expect(trash.status).toBe(409);
    expect((trash.body as { message: string }).message).toContain('thùng rác');
    const purged = await http().patch(`/api/v1/admin/tools/jobs/${ids.purged}`).set('Authorization', auth).send(body);
    expect(purged.status).toBe(409);
    expect((purged.body as { message: string }).message).toContain('vĩnh viễn');
    expect((await prisma.job.findUniqueOrThrow({ where: { id: ids.trash } })).salary).toBe(180_000);
    await http().patch(`/api/v1/admin/tools/jobs/${ids.live}`).set('Authorization', auth).send(body).expect(200);
  });

  it('danh sách sửa tin và chi tiết có nhãn NTD đã xoá', async () => {
    const list = await http().get(`/api/v1/admin/tools/jobs?q=VP-ADJ`).set('Authorization', auth).expect(200);
    const byId = Object.fromEntries((list.body as { items: Array<{ id: string; removedByOwner: string | null }> }).items.map((i) => [i.id, i.removedByOwner]));
    expect(byId).toEqual({ [ids.live]: null, [ids.trash]: 'trash', [ids.purged]: 'purged' });
    const detail = await http().get(`/api/v1/admin/jobs/${ids.trash}`).set('Authorization', auth).expect(200);
    expect((detail.body as { removedByOwner: string }).removedByOwner).toBe('trash');
  });

  it('tab "Yêu cầu sửa" không còn tin NTD đã xoá; tin đó chuyển sang "Đã xử lý" kèm nhãn', async () => {
    const changes = await http().get('/api/v1/admin/jobs/pending?tab=changes&q=VP-ADJ').set('Authorization', auth).expect(200);
    expect((changes.body as ModerationList).items.map((i) => i.id)).toEqual([ids.live]);
    const done = await http().get('/api/v1/admin/jobs/pending?tab=done&q=VP-ADJ').set('Authorization', auth).expect(200);
    const items = (done.body as ModerationList).items;
    expect(Object.fromEntries(items.map((i) => [i.id, i.removedByOwner]))).toEqual({ [ids.trash]: 'trash', [ids.purged]: 'purged' });
  });
});
