import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AssetUrlService } from '../src/core/assets/asset-url.service.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { EmployerContext } from '../src/modules/employer-portal/employer-context.service.js';
import { EmployerProfileController } from '../src/modules/employer-portal/employer-profile.controller.js';
import { EmployerProfileService } from '../src/modules/employer-portal/employer-profile.service.js';

const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';

/** u-admin: quản trị viên doanh nghiệp · u-member: thành viên thường · u-solo: NTD cá nhân */
const actors: Record<string, { recruiterId: string; employerId: string | null; companyAdmin: boolean }> = {
  'u-admin': { recruiterId: 'r-admin', employerId: 'e1', companyAdmin: true },
  'u-member': { recruiterId: 'r-member', employerId: 'e1', companyAdmin: false },
  'u-solo': { recruiterId: 'r-solo', employerId: null, companyAdmin: false },
};

const company = { stats: [], values: [], offices: [], fields: [] };
const validCompany = { shortName: 'CAMCOM', intro: 'Giới thiệu', sections: company };

describe('Cài đặt hồ sơ NTD /employer/profile (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const employerUpdate = vi.fn(async () => ({}));

  beforeAll(async () => {
    const recruiterRow = (id: string) => {
      const a = Object.values(actors).find((x) => x.recruiterId === id)!;
      return {
        slug: id, name: 'Cán bộ', title: 'Tư vấn viên', headline: null, intro: null, city: null, phone: null, photoUrl: null, sections: {}, companyAdmin: a.companyAdmin,
        employer: a.employerId ? { slug: 'camcom', name: 'CAMCOM', taxCode: null, verified: true, shortName: null, intro: null, phone: null, email: null, website: null, address: null, logoUrl: null, coverUrl: null, sections: {} } : null,
      };
    };
    const prisma = {
      recruiter: { findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => recruiterRow(where.id)), update: vi.fn() },
      employer: { findUniqueOrThrow: vi.fn(async () => ({ logoUrl: null, coverUrl: null, sections: { legal: [['MST', '1']] } })), update: employerUpdate },
      user: { update: vi.fn() },
      $transaction: vi.fn(async () => []),
    };
    const ctx = {
      resolve: vi.fn(async (userId: string) => {
        const a = actors[userId]!;
        return { userId, recruiterId: a.recruiterId, employerId: a.employerId, verified: true };
      }),
    };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [EmployerProfileController],
      providers: [
        AuthGuard,
        EmployerProfileService,
        { provide: EmployerContext, useValue: ctx },
        { provide: PrismaService, useValue: prisma },
        { provide: AssetUrlService, useValue: { url: (p: string | null) => p } },
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

  it('401 khi chưa đăng nhập', async () => {
    await http().get('/api/v1/employer/profile').expect(401);
  });

  it('403 với vai trò ứng viên', async () => {
    await http().get('/api/v1/employer/profile').set('Authorization', await auth('seeker', 'u-seeker')).expect(403);
  });

  it('thành viên xem được hồ sơ công ty nhưng không được sửa (canEdit = false)', async () => {
    const res = await http().get('/api/v1/employer/profile').set('Authorization', await auth('employer', 'u-member')).expect(200);
    expect(res.body.company.canEdit).toBe(false);
  });

  it('403 khi thành viên thường sửa hồ sơ công ty', async () => {
    await http().put('/api/v1/employer/profile/company').set('Authorization', await auth('employer', 'u-member')).send(validCompany).expect(403);
    expect(employerUpdate).not.toHaveBeenCalled();
  });

  it('404 khi NTD cá nhân sửa hồ sơ công ty', async () => {
    await http().put('/api/v1/employer/profile/company').set('Authorization', await auth('employer', 'u-solo')).send(validCompany).expect(404);
  });

  it('400 khi dùng ảnh không do mình tải lên', async () => {
    await http()
      .put('/api/v1/employer/profile/company')
      .set('Authorization', await auth('employer', 'u-admin'))
      .send({ ...validCompany, logoPath: 'uploads/otheruser/0f8fad5b-d9cb-469f-a165-70867728950e.png' })
      .expect(400);
  });

  it('quản trị viên doanh nghiệp sửa được, giữ khối pháp lý', async () => {
    await http().put('/api/v1/employer/profile/company').set('Authorization', await auth('employer', 'u-admin')).send(validCompany).expect(200);
    expect(employerUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sections: expect.objectContaining({ legal: [['MST', '1']] }) }) }));
  });
});
