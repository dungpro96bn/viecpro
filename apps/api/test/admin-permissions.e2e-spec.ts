import { randomBytes } from 'node:crypto';
import { type INestApplication, RequestMethod, type Type } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ADMIN_PERMISSIONS } from '@viecpro/shared';
import request from 'supertest';
import { ConfigModule } from '../src/config/config.module.js';
import { AssetsModule } from '../src/core/assets/assets.module.js';
import { AuditModule } from '../src/core/audit/audit.service.js';
import { IS_PUBLIC } from '../src/core/auth/auth.decorators.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { AllExceptionsFilter } from '../src/core/http/all-exceptions.filter.js';
import { MailModule } from '../src/core/mail/mail.module.js';
import { PrismaModule } from '../src/core/prisma/prisma.module.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { AdminGuard } from '../src/modules/admin/admin-access.js';
import { AdminModule } from '../src/modules/admin/admin.module.js';
import { NotificationsModule } from '../src/modules/notifications/notifications.module.js';

/**
 * Ma trận quyền cho MỌI route quản trị (RULE-BE.md mục 6 lớp 3, mục 14) – tự quét controller trong AdminModule,
 * nên route admin thêm sau này cũng tự được kiểm tra. Chạy AdminGuard + Postgres thật: `npm run test:e2e:db`.
 *
 * Mỗi route có AdminGuard:
 * - khai báo đúng một quyền (@RequirePermission) hoặc @AnyAdmin – thiếu là lỗi (fail-closed)
 * - chưa đăng nhập → 401; tài khoản NTD → 403
 * - admin có MỌI quyền trừ đúng quyền route cần → 403 (chứng minh route kiểm tra đúng quyền đó, không phải quyền khác)
 * - admin có quyền → qua được guard (không 401 / 403; id giả nên thường là 400 / 404)
 */
const DB_URL = process.env.E2E_DATABASE_URL;
const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';
const PERMISSION_KEY = 'admin:permission';
const ANY_ADMIN = '*';

interface AdminRoute {
  name: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  permission: string | undefined;
}

const VERB: Partial<Record<RequestMethod, AdminRoute['method']>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

function join(...parts: Array<string | string[] | undefined>): string {
  const segments = parts.map((p) => (Array.isArray(p) ? p[0] : p)).filter((p): p is string => !!p && p !== '/');
  return `/${segments.map((s) => s.replace(/^\/|\/$/g, '')).join('/')}`;
}

/** Route đi qua AdminGuard (controller gắn @AdminController), bỏ route @Public */
function adminRoutes(): AdminRoute[] {
  const controllers = (Reflect.getMetadata('controllers', AdminModule) ?? []) as Type[];
  const routes: AdminRoute[] = [];
  for (const controller of controllers) {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
    if (!guards.includes(AdminGuard)) continue;
    const base = Reflect.getMetadata(PATH_METADATA, controller) as string | string[] | undefined;
    for (const key of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (controller.prototype as Record<string, unknown>)[key];
      if (typeof handler !== 'function' || key === 'constructor') continue;
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
      const verb = VERB[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      if (sub === undefined || !verb) continue;
      if (Reflect.getMetadata(IS_PUBLIC, handler) || Reflect.getMetadata(IS_PUBLIC, controller)) continue;
      const permission = (Reflect.getMetadata(PERMISSION_KEY, handler) ?? Reflect.getMetadata(PERMISSION_KEY, controller)) as string | undefined;
      const path = join(base, sub).replace(/:[A-Za-z]+/g, 'e2e-khong-ton-tai');
      routes.push({ name: `${controller.name}.${key}`, method: verb, path, permission });
    }
  }
  return routes;
}

/** Xoá dữ liệu test tạo ra (database e2e riêng – nhật ký thao tác ở đây không phải dữ liệu thật) */
async function cleanup(prisma: PrismaService) {
  const users = { email: { endsWith: '@perm.e2e' } };
  const ids = (await prisma.user.findMany({ where: users, select: { id: true } })).map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.adminExportToken.deleteMany({ where: { adminId: { in: ids } } });
  await prisma.user.deleteMany({ where: users });
  await prisma.adminRole.deleteMany({ where: { key: { startsWith: 'e2e-perm-' } } });
}

describe.skipIf(!DB_URL)('Ma trận quyền mọi route /admin/* – AdminGuard + Postgres thật (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let prisma: PrismaService;
  const routes = adminRoutes();
  /** Token admin theo vai trò: 'all', 'none', hoặc 'without:<quyền>' */
  const tokens = new Map<string, string>();
  let employerToken = '';

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: DB_URL,
      JWT_SECRET,
      OTP_SECRET: 'e2e-otp-secret-with-at-least-32-characters!!',
      ADMIN_MFA_KEY: 'e2e-admin-mfa-key-with-at-least-32-chars!!',
      // Bỏ bước nhập lại mã 2FA của hành động phá huỷ – test chỉ xét phân quyền
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
    jwt = module.get(JwtService);
    prisma = module.get(PrismaService);

    // Dọn dữ liệu của lần chạy trước (chỉ bản ghi do test này tạo)
    await cleanup(prisma);

    const variants: Array<[string, string[]]> = [
      ['all', [...ADMIN_PERMISSIONS]],
      ['none', []],
      ...ADMIN_PERMISSIONS.map((p): [string, string[]] => [`without:${p}`, ADMIN_PERMISSIONS.filter((x) => x !== p)]),
    ];
    for (const [variant, permissions] of variants) {
      const slug = variant.replace(/[^a-z]/gi, '-');
      const role = await prisma.adminRole.create({ data: { key: `e2e-perm-${slug}`, name: variant, permissions } });
      const user = await prisma.user.create({ data: { role: 'admin', name: `Admin ${variant}`, email: `${slug}@perm.e2e`, mfaEnabledAt: new Date(), adminRoleId: role.id } });
      const session = await prisma.session.create({
        data: { userId: user.id, refreshTokenHash: randomBytes(24).toString('hex'), isAdmin: true, expiresAt: new Date(Date.now() + 3600_000) },
      });
      tokens.set(variant, `Bearer ${await jwt.signAsync({ sub: user.id, role: 'admin', sid: session.id, adm: true })}`);
    }
    employerToken = `Bearer ${await jwt.signAsync({ sub: 'perm-e2e-employer', role: 'employer', sid: 'perm-e2e-employer-s' })}`;
  });

  afterAll(async () => {
    if (prisma) await cleanup(prisma);
    await app?.close();
  });

  const call = (route: AdminRoute, auth?: string) => {
    let req = request(app.getHttpServer())[route.method](`/api/v1${route.path}`);
    if (auth) req = req.set('Authorization', auth);
    return route.method === 'get' || route.method === 'delete' ? req : req.send({});
  };

  it('quét được route quản trị (gồm các route mới: sửa tin thay NTD, xuất CSV, cài đặt, nội dung trang chủ, khách cần tư vấn)', () => {
    expect(routes.length).toBeGreaterThan(30);
    const paths = routes.map((r) => r.path);
    for (const p of ['/admin/tools/jobs', '/admin/tools/exports', '/admin/tools/system', '/admin/tools/homepage', '/admin/leads']) expect(paths).toContain(p);
  });

  it('mọi route quản trị khai báo đúng một quyền có trong ADMIN_PERMISSIONS (hoặc @AnyAdmin)', () => {
    const invalid = routes.filter((r) => r.permission !== ANY_ADMIN && !(ADMIN_PERMISSIONS as readonly string[]).includes(r.permission ?? ''));
    expect(invalid.map((r) => `${r.name} → ${r.permission ?? '(thiếu)'}`)).toEqual([]);
  });

  it('route mới dùng đúng quyền theo bảng RULE-BE.md mục 6 (thao tác ghi không dùng quyền đọc)', () => {
    const expected: Record<string, string> = {
      'GET /admin/tools/jobs': 'jobs.manage',
      'GET /admin/tools/jobs/e2e-khong-ton-tai': 'jobs.manage',
      'PATCH /admin/tools/jobs/e2e-khong-ton-tai': 'jobs.manage',
      'GET /admin/tools/system': 'settings.manage',
      'PATCH /admin/tools/system': 'settings.manage',
      'GET /admin/tools/homepage': 'content.manage',
      'PATCH /admin/tools/homepage': 'content.manage',
      'POST /admin/tools/exports': 'data.export',
      'GET /admin/leads': 'leads.read',
      'POST /admin/leads/e2e-khong-ton-tai/handle': 'leads.manage',
    };
    const actual = Object.fromEntries(routes.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r.permission]));
    expect(Object.fromEntries(Object.keys(expected).map((k) => [k, actual[k]]))).toEqual(expected);
  });

  it('401 khi chưa đăng nhập, 403 với tài khoản nhà tuyển dụng', async () => {
    const wrong: string[] = [];
    for (const route of routes) {
      const anonymous = (await call(route)).status;
      const employer = (await call(route, employerToken)).status;
      if (anonymous !== 401 || employer !== 403) wrong.push(`${route.method.toUpperCase()} ${route.path}: ẩn danh ${anonymous}, NTD ${employer}`);
    }
    expect(wrong).toEqual([]);
  });

  it('403 khi admin có mọi quyền trừ đúng quyền route cần', async () => {
    const wrong: string[] = [];
    for (const route of routes.filter((r) => r.permission !== ANY_ADMIN)) {
      const res = await call(route, tokens.get(`without:${route.permission}`));
      if (res.status !== 403) wrong.push(`${route.method.toUpperCase()} ${route.path} (${route.permission}): ${res.status}`);
    }
    expect(wrong).toEqual([]);
  });

  it('qua được guard khi có đúng quyền; route @AnyAdmin mở cho admin không có quyền nào', async () => {
    const wrong: string[] = [];
    // Đăng xuất thu hồi phiên đang dùng – chạy sau cùng để không ảnh hưởng route khác
    const ordered = [...routes].sort((a, b) => Number(a.path.endsWith('/logout')) - Number(b.path.endsWith('/logout')));
    for (const route of ordered) {
      // Route thường: vai trò có mọi quyền. Route @AnyAdmin: vai trò không có quyền nào vẫn phải vào được
      const res = await call(route, tokens.get(route.permission === ANY_ADMIN ? 'none' : 'all'));
      if (res.status === 401 || res.status === 403 || res.status >= 500) wrong.push(`${route.method.toUpperCase()} ${route.path}: ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
    }
    expect(wrong).toEqual([]);
  });
});
