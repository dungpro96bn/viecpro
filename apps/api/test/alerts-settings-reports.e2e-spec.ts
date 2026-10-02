import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ENV } from '../src/config/env.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { ApiException } from '../src/core/http/api-exception.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { AdminGuard } from '../src/modules/admin/admin-access.js';
import { AdminReportsController } from '../src/modules/admin/reports/admin-reports.controller.js';
import { AdminReportsService } from '../src/modules/admin/reports/admin-reports.service.js';
import { AdminUsersController } from '../src/modules/admin/users/admin-users.controller.js';
import { AdminUsersService } from '../src/modules/admin/users/admin-users.service.js';
import { SessionService } from '../src/modules/auth/session.service.js';
import { JobAlertsController } from '../src/modules/job-alerts/job-alerts.controller.js';
import { JobAlertsService } from '../src/modules/job-alerts/job-alerts.service.js';
import { AccountSettingsService } from '../src/modules/me/account-settings.service.js';
import { SettingsController } from '../src/modules/me/settings.controller.js';
import { ReportsController } from '../src/modules/reports/reports.controller.js';
import { ReportsService } from '../src/modules/reports/reports.service.js';

const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';
const notFound = () => ApiException.notFound();

describe('Thông báo việc làm, cài đặt, báo cáo vi phạm, admin (e2e phân quyền)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const createReport = vi.fn(async () => ({ code: 'BC-1', dueAt: new Date().toISOString() }));
  let adminPermissions: string[] = ['users.read', 'jobs.moderate'];

  beforeAll(async () => {
    const alerts = {
      list: vi.fn(async () => ({ items: [], total: 0, enabledCount: 0, unseen: 0, max: 10 })),
      update: vi.fn(async (userId: string, id: string) => {
        if (userId !== 'seeker-owner' || id !== 'own-alert') throw notFound();
        return { id };
      }),
      remove: vi.fn(async (userId: string, id: string) => {
        if (userId !== 'seeker-owner' || id !== 'own-alert') throw notFound();
      }),
    };
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          id: 'admin-1',
          name: 'Admin',
          email: 'admin@viecpro.vn',
          mfaEnabledAt: new Date(),
          adminRole: { key: 'moderator', name: 'Kiểm duyệt viên', permissions: adminPermissions },
        })),
      },
    };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [JobAlertsController, SettingsController, ReportsController, AdminUsersController, AdminReportsController],
      providers: [
        AuthGuard,
        AdminGuard,
        { provide: JobAlertsService, useValue: alerts },
        { provide: AccountSettingsService, useValue: { get: vi.fn(async () => ({})) } },
        { provide: ReportsService, useValue: { create: createReport, mine: vi.fn() } },
        { provide: AdminUsersService, useValue: { detail: vi.fn(async () => { throw notFound(); }), list: vi.fn(async () => ({ items: [] })) } },
        { provide: AdminReportsService, useValue: { decide: vi.fn(async () => ({})) } },
        { provide: PrismaService, useValue: prisma },
        { provide: SessionService, useValue: { isActive: vi.fn(async () => true) } },
        { provide: ENV, useValue: { ADMIN_IP_ALLOWLIST: [] } },
      ],
    }).compile();
    app = module.createNestApplication();
    jwt = module.get(JwtService);
    app.useGlobalGuards(module.get(AuthGuard));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const token = (role: 'seeker' | 'employer' | 'admin', sub: string, adm = false) => jwt.signAsync({ sub, role, sid: `${sub}-session`, ...(adm && { adm: true }) });
  const http = () => request(app.getHttpServer());

  describe('/me/alerts', () => {
    it('401 khi chưa đăng nhập', async () => {
      await http().get('/api/v1/me/alerts').expect(401);
    });
    it('403 với nhà tuyển dụng', async () => {
      await http().get('/api/v1/me/alerts').set('Authorization', `Bearer ${await token('employer', 'e1')}`).expect(403);
    });
    it('404 khi sửa / xoá thông báo của người khác', async () => {
      const t = await token('seeker', 'seeker-other');
      await http().patch('/api/v1/me/alerts/own-alert').set('Authorization', `Bearer ${t}`).send({ enabled: false }).expect(404);
      await http().delete('/api/v1/me/alerts/own-alert').set('Authorization', `Bearer ${t}`).expect(404);
    });
    it('chủ sở hữu sửa được, dữ liệu sai bị chặn', async () => {
      const t = await token('seeker', 'seeker-owner');
      await http().patch('/api/v1/me/alerts/own-alert').set('Authorization', `Bearer ${t}`).send({ enabled: false }).expect(200);
      await http().patch('/api/v1/me/alerts/own-alert').set('Authorization', `Bearer ${t}`).send({ channels: [] }).expect(400);
    });
  });

  describe('/me/settings', () => {
    it('401 khi chưa đăng nhập', async () => {
      await http().get('/api/v1/me/settings').expect(401);
    });
    it('403 với tài khoản admin (admin dùng khu /admin)', async () => {
      await http().get('/api/v1/me/settings').set('Authorization', `Bearer ${await token('admin', 'a1')}`).expect(403);
    });
    it('chặn giờ yên lặng sai định dạng', async () => {
      await http().patch('/api/v1/me/settings').set('Authorization', `Bearer ${await token('seeker', 's1')}`).send({ quietHours: { from: '25:00' } }).expect(400);
    });
  });

  describe('POST /reports', () => {
    it('khách gửi được, không gắn người báo cáo', async () => {
      await http().post('/api/v1/reports').send({ targetType: 'job', target: 'don-a', reason: 'fee' }).expect(201);
      expect(createReport).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'fee' }), undefined, expect.anything());
    });
    it('lý do "khác" cần mô tả, không báo cáo được ứng viên', async () => {
      await http().post('/api/v1/reports').send({ targetType: 'job', target: 'don-a', reason: 'other' }).expect(400);
      await http().post('/api/v1/reports').send({ targetType: 'user', target: 'u1', reason: 'fee' }).expect(400);
    });
  });

  describe('/admin/users', () => {
    it('401 khi chưa đăng nhập', async () => {
      await http().get('/api/v1/admin/users').expect(401);
    });
    it('403 với người tìm việc', async () => {
      await http().get('/api/v1/admin/users').set('Authorization', `Bearer ${await token('seeker', 's1')}`).expect(403);
    });
    it('403 với token admin chưa qua 2FA', async () => {
      await http().get('/api/v1/admin/users').set('Authorization', `Bearer ${await token('admin', 'admin-1')}`).expect(403);
    });
    it('403 khi thiếu quyền users.pii để hiện liên hệ', async () => {
      await http().post('/api/v1/admin/users/u1/reveal').set('Authorization', `Bearer ${await token('admin', 'admin-1', true)}`).expect(403);
    });
    it('404 khi không có ứng viên', async () => {
      await http().get('/api/v1/admin/users/missing').set('Authorization', `Bearer ${await token('admin', 'admin-1', true)}`).expect(404);
    });
  });

  describe('/admin/reports', () => {
    it('quyết định khoá cần thêm quyền users.lock', async () => {
      adminPermissions = ['jobs.moderate'];
      const t = await token('admin', 'admin-1', true);
      await http().post('/api/v1/admin/reports/r1/decide').set('Authorization', `Bearer ${t}`).send({ decision: 'ban', note: 'Lừa đảo đặt cọc' }).expect(403);
      await http().post('/api/v1/admin/reports/r1/decide').set('Authorization', `Bearer ${t}`).send({ decision: 'dismiss' }).expect(200);
    });
  });
});
