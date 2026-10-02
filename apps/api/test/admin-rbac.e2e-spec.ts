import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ENV } from '../src/config/env.js';
import { AuditService } from '../src/core/audit/audit.service.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { AdminGuard } from '../src/modules/admin/admin-access.js';
import { AdminAccountsController } from '../src/modules/admin/admins/admin-accounts.controller.js';
import { AdminAccountsService } from '../src/modules/admin/admins/admin-accounts.service.js';
import { AdminRolesController } from '../src/modules/admin/admins/admin-roles.controller.js';
import { AdminMeController } from '../src/modules/admin/auth/admin-auth.controller.js';
import { AdminAuthService } from '../src/modules/admin/auth/admin-auth.service.js';
import { AdminRolesService } from '../src/modules/admin/admins/admin-roles.service.js';
import { StepUpService } from '../src/modules/admin/sanctions/step-up.service.js';
import { SessionService } from '../src/modules/auth/session.service.js';

const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';
const ALL = ['dashboard.read', 'users.read', 'users.pii', 'admins.manage', 'jobs.read'];

/** Tài khoản admin trong "DB" giả: a-super (super_admin duy nhất), a-mod (moderator) */
const accounts: Record<string, { key: string; permissions: string[] }> = {
  'a-super': { key: 'super_admin', permissions: ALL },
  'a-mod': { key: 'moderator', permissions: ['users.read'] },
};
const roles: Record<string, { key: string; permissions: string[] }> = {
  'r-support': { key: 'support', permissions: ['users.read', 'users.pii'] },
};

describe('Phân quyền quản trị /admin/admins, /admin/roles (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  /** Quyền của người đang gọi API */
  let actor = { id: 'a-manager', key: 'hr_lead', permissions: ['admins.manage', 'users.read'] };
  /** Người đang gọi đang dùng mật khẩu tạm */
  let mustChangePassword = false;
  const changePassword = vi.fn(async () => ({ mustChangePassword: false }));

  beforeAll(async () => {
    const accountRow = (id: string) => {
      const a = accounts[id];
      return a ? { id, name: id, email: `${id}@viecpro.vn`, mfaEnabledAt: new Date(), lockedAt: null, lockReason: null, lastLoginAt: null, createdAt: new Date(), adminRole: { id: `r-${a.key}`, key: a.key, name: a.key, permissions: a.permissions } } : null;
    };
    const tx = {
      user: { count: vi.fn(async () => 0), update: vi.fn(), findMany: vi.fn(async () => []) },
      session: { updateMany: vi.fn() },
    };
    const prisma = {
      user: {
        // AdminGuard tải người đang gọi
        findUnique: vi.fn(async () => ({ id: actor.id, name: 'Actor', email: 'actor@viecpro.vn', mfaEnabledAt: new Date(), mustChangePassword, adminRoleId: `r-${actor.key}`, adminRole: { key: actor.key, name: actor.key, permissions: actor.permissions } })),
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => accountRow(where.id)),
      },
      adminRole: {
        findUnique: vi.fn(async ({ where }: { where: { id?: string } }) => {
          const r = where.id ? roles[where.id] : undefined;
          return r ? { id: where.id, name: r.key, description: null, isSystem: false, updatedAt: new Date(), _count: { users: 0 }, ...r } : null;
        }),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [AdminAccountsController, AdminRolesController, AdminMeController],
      providers: [
        AuthGuard,
        AdminGuard,
        AdminAccountsService,
        AdminRolesService,
        StepUpService,
        { provide: AuditService, useValue: { log: vi.fn() } },
        { provide: AdminAuthService, useValue: { changePassword, me: vi.fn(async () => ({})) } },
        { provide: PrismaService, useValue: prisma },
        { provide: SessionService, useValue: { isActive: vi.fn(async () => true) } },
        // Bỏ qua bước nhập mã 2FA xác nhận lại để test tập trung vào phân quyền
        { provide: ENV, useValue: { ADMIN_IP_ALLOWLIST: [], ADMIN_MFA_BYPASS: true, ADMIN_MFA_KEY: 'e2e-admin-mfa-key-with-at-least-32-chars' } },
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

  const http = () => request(app.getHttpServer());
  const token = (role: 'seeker' | 'admin', sub: string, adm = true) => jwt.signAsync({ sub, role, sid: `${sub}-session`, ...(adm && { adm: true }) });
  const as = async (who: typeof actor) => {
    actor = who;
    return `Bearer ${await token('admin', who.id)}`;
  };
  const manager = { id: 'a-manager', key: 'hr_lead', permissions: ['admins.manage', 'users.read'] };
  const superAdmin = { id: 'a-super', key: 'super_admin', permissions: ALL };

  describe('/admin/admins', () => {
    it('401 khi chưa đăng nhập', async () => {
      await http().get('/api/v1/admin/admins').expect(401);
    });

    it('403 với vai trò không phải admin', async () => {
      await http().get('/api/v1/admin/admins').set('Authorization', `Bearer ${await token('seeker', 's1', false)}`).expect(403);
    });

    it('403 khi admin thiếu quyền admins.manage', async () => {
      const auth = await as({ id: 'a-mod', key: 'moderator', permissions: ['users.read'] });
      await http().get('/api/v1/admin/admins').set('Authorization', auth).expect(403);
    });

    it('404 với quản trị viên không tồn tại', async () => {
      await http().post('/api/v1/admin/admins/missing/lock').set('Authorization', await as(manager)).send({ reason: 'Nghỉ việc' }).expect(404);
    });

    it('403 khi tự khoá chính mình', async () => {
      await http().post('/api/v1/admin/admins/a-super/lock').set('Authorization', await as(superAdmin)).send({ reason: 'Thử tự khoá' }).expect(403);
    });

    it('403 khi admin thường khoá Super Admin', async () => {
      await http().post('/api/v1/admin/admins/a-super/lock').set('Authorization', await as(manager)).send({ reason: 'Không được phép' }).expect(403);
    });

    it('409 khi hạ quyền Super Admin cuối cùng', async () => {
      accounts['a-super-2'] = { key: 'super_admin', permissions: ALL };
      roles['r-support'] = { key: 'support', permissions: ['users.read'] };
      await http().post('/api/v1/admin/admins/a-super-2/role').set('Authorization', await as({ ...superAdmin, id: 'a-super-3' })).send({ roleId: 'r-support' }).expect(409);
    });

    it('403 khi gán vai trò có quyền mình không có (leo thang quyền)', async () => {
      roles['r-support'] = { key: 'support', permissions: ['users.read', 'users.pii'] };
      await http().post('/api/v1/admin/admins/a-mod/role').set('Authorization', await as(manager)).send({ roleId: 'r-support' }).expect(403);
    });
  });

  describe('/admin/roles', () => {
    it('401 khi chưa đăng nhập', async () => {
      await http().get('/api/v1/admin/roles').expect(401);
    });

    it('403 khi admin thiếu quyền admins.manage', async () => {
      const auth = await as({ id: 'a-mod', key: 'moderator', permissions: ['users.read'] });
      await http().put('/api/v1/admin/roles/r-support').set('Authorization', auth).send({ name: 'Hỗ trợ', permissions: ['users.read'] }).expect(403);
    });

    it('404 với vai trò không tồn tại', async () => {
      await http().put('/api/v1/admin/roles/missing').set('Authorization', await as(manager)).send({ name: 'Hỗ trợ', permissions: ['users.read'] }).expect(404);
    });

    it('403 khi tạo vai trò có quyền mình không có', async () => {
      await http().post('/api/v1/admin/roles').set('Authorization', await as(manager)).send({ key: 'exporter', name: 'Xuất dữ liệu', permissions: ['data.export'] }).expect(403);
    });
  });

  describe('mật khẩu tạm', () => {
    afterEach(() => {
      mustChangePassword = false;
    });

    it('401 khi đổi mật khẩu mà chưa đăng nhập', async () => {
      await http().post('/api/v1/admin/password').send({ currentPassword: 'x', newPassword: 'Moi12345' }).expect(401);
    });

    it('403 PASSWORD_CHANGE_REQUIRED với route nghiệp vụ khi đang dùng mật khẩu tạm', async () => {
      mustChangePassword = true;
      const res = await http().get('/api/v1/admin/admins').set('Authorization', await as(superAdmin)).expect(403);
      expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('vẫn đổi được mật khẩu khi đang dùng mật khẩu tạm', async () => {
      mustChangePassword = true;
      await http().post('/api/v1/admin/password').set('Authorization', await as(superAdmin)).send({ currentPassword: 'TamThoi123', newPassword: 'MoiHon2026' }).expect(200);
      expect(changePassword).toHaveBeenCalled();
    });

    it('400 khi mật khẩu mới trùng mật khẩu hiện tại hoặc quá yếu', async () => {
      const auth = await as(superAdmin);
      await http().post('/api/v1/admin/password').set('Authorization', auth).send({ currentPassword: 'MoiHon2026', newPassword: 'MoiHon2026' }).expect(400);
      await http().post('/api/v1/admin/password').set('Authorization', auth).send({ currentPassword: 'MoiHon2026', newPassword: 'yeu' }).expect(400);
    });
  });
});
