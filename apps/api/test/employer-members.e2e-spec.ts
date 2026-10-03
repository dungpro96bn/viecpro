import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ENV } from '../src/config/env.js';
import { AssetUrlService } from '../src/core/assets/asset-url.service.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { EmailSender } from '../src/core/mail/email-sender.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { OtpService } from '../src/modules/auth/otp.service.js';
import { EmployerContext } from '../src/modules/employer-portal/employer-context.service.js';
import { EmployerMembersController, MemberInvitesController } from '../src/modules/employer-portal/employer-members.controller.js';
import { EmployerMembersService } from '../src/modules/employer-portal/employer-members.service.js';
import { MemberInvitesService } from '../src/modules/employer-portal/member-invites.service.js';
import { SmsSender } from '../src/modules/notifications/sms-sender.js';

const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';

/** Doanh nghiệp e1: r-admin (quản trị), r-member; e2: r-other. u-solo là NTD cá nhân */
const actors: Record<string, { recruiterId: string; employerId: string | null; companyAdmin: boolean }> = {
  'u-admin': { recruiterId: 'r-admin', employerId: 'e1', companyAdmin: true },
  'u-member': { recruiterId: 'r-member', employerId: 'e1', companyAdmin: false },
  'u-solo': { recruiterId: 'r-solo', employerId: null, companyAdmin: false },
};
const recruiters: Record<string, { employerId: string; userId: string | null }> = {
  'r-admin': { employerId: 'e1', userId: 'u-admin' },
  'r-member': { employerId: 'e1', userId: 'u-member' },
  'r-other': { employerId: 'e2', userId: 'u-other' },
};
const TAKEN_PHONE = '+84900000001';

describe('Thành viên doanh nghiệp /employer/members, /invites (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const sms = { send: vi.fn(async () => undefined) };
  const transaction = vi.fn(async () => []);

  beforeAll(async () => {
    const prisma = {
      recruiter: {
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({ companyAdmin: Object.values(actors).find((a) => a.recruiterId === where.id)!.companyAdmin })),
        findFirst: vi.fn(async ({ where }: { where: { id: string; employerId: string } }) => {
          const r = recruiters[where.id];
          return r && r.employerId === where.employerId ? { id: where.id, userId: r.userId } : null;
        }),
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 2),
      },
      user: { findFirst: vi.fn(async ({ where }: { where: { phone: string } }) => (where.phone === TAKEN_PHONE ? { id: 'u-x' } : null)) },
      memberInvite: {
        count: vi.fn(async () => 0),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'inv-1', name: data.name, phone: data.phone, email: data.email, title: data.title, companyAdmin: data.companyAdmin,
          createdAt: new Date(), expiresAt: data.expiresAt, invitedBy: { name: 'Admin' }, employer: { name: 'CAMCOM', shortName: null },
        })),
      },
      $transaction: transaction,
    };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [EmployerMembersController, MemberInvitesController],
      providers: [
        AuthGuard,
        EmployerMembersService,
        MemberInvitesService,
        { provide: EmployerContext, useValue: { resolve: vi.fn(async (userId: string) => ({ userId, ...actors[userId]!, verified: true })) } },
        { provide: PrismaService, useValue: prisma },
        { provide: AssetUrlService, useValue: { url: (p: string | null) => p } },
        { provide: SmsSender, useValue: sms },
        { provide: EmailSender, useValue: { send: vi.fn() } },
        { provide: OtpService, useValue: { send: vi.fn(), verify: vi.fn() } },
        { provide: ENV, useValue: { NODE_ENV: 'development', WEB_BASE_URL: 'http://localhost:3100' } },
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
  const auth = async (role: 'seeker' | 'employer', sub: string) => `Bearer ${await jwt.signAsync({ sub, role, sid: `${sub}-s` })}`;
  const invite = { name: 'Lê Văn Bình', phone: '0911222333', title: 'Cán bộ tuyển dụng' };

  it('401 khi chưa đăng nhập', async () => {
    await http().get('/api/v1/employer/members').expect(401);
  });

  it('403 với vai trò ứng viên', async () => {
    await http().get('/api/v1/employer/members').set('Authorization', await auth('seeker', 'u-seeker')).expect(403);
  });

  it('404 với NTD cá nhân (không thuộc doanh nghiệp)', async () => {
    await http().get('/api/v1/employer/members').set('Authorization', await auth('employer', 'u-solo')).expect(404);
  });

  it('403 khi thành viên thường mời người mới', async () => {
    await http().post('/api/v1/employer/members/invites').set('Authorization', await auth('employer', 'u-member')).send(invite).expect(403);
  });

  it('404 khi gỡ thành viên của doanh nghiệp khác', async () => {
    await http().post('/api/v1/employer/members/r-other/remove').set('Authorization', await auth('employer', 'u-admin')).send({}).expect(404);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('403 khi tự gỡ / tự đổi quyền chính mình', async () => {
    const a = await auth('employer', 'u-admin');
    await http().post('/api/v1/employer/members/r-admin/remove').set('Authorization', a).send({}).expect(403);
    await http().patch('/api/v1/employer/members/r-admin/role').set('Authorization', a).send({ companyAdmin: false }).expect(403);
  });

  it('409 khi mời số đã có tài khoản viecpro', async () => {
    await http().post('/api/v1/employer/members/invites').set('Authorization', await auth('employer', 'u-admin')).send({ ...invite, phone: '0900000001' }).expect(409);
  });

  it('quản trị viên mời được: gửi SMS chứa link, trả devLink ngoài production', async () => {
    const res = await http().post('/api/v1/employer/members/invites').set('Authorization', await auth('employer', 'u-admin')).send(invite).expect(201);
    expect(res.body.invite.phone).toBe('+84911222333');
    expect(res.body.devLink).toMatch(/^http:\/\/localhost:3100\/moi-thanh-vien\/[A-Za-z0-9_-]{43}$/);
    expect(sms.send).toHaveBeenCalledWith('+84911222333', expect.stringContaining(res.body.devLink));
  });

  it('404 với link mời sai / không tồn tại (không lộ lời mời có tồn tại)', async () => {
    await http().get('/api/v1/invites/khong-hop-le').expect(404);
    await http().get(`/api/v1/invites/${'a'.repeat(43)}`).expect(404);
    await http().post(`/api/v1/invites/${'a'.repeat(43)}/accept`).send({ code: '123456', password: 'MatKhau2026' }).expect(404);
  });
});
