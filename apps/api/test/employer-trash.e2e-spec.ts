import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AssetUrlService } from '../src/core/assets/asset-url.service.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { EmployerContext } from '../src/modules/employer-portal/employer-context.service.js';
import { EmployerTrashController } from '../src/modules/employer-portal/employer-trash.controller.js';
import { EmployerJobTrashService } from '../src/modules/employer-portal/employer-job-trash.service.js';
import { EmployerTrashService } from '../src/modules/employer-portal/employer-trash.service.js';

const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';

const actors: Record<string, { recruiterId: string; employerId: string | null; companyAdmin: boolean }> = {
  'u-admin': { recruiterId: 'r-admin', employerId: 'e1', companyAdmin: true },
  'u-member': { recruiterId: 'r-member', employerId: 'e1', companyAdmin: false },
  'u-solo': { recruiterId: 'r-solo', employerId: null, companyAdmin: false },
};
/** Thành viên trong thùng rác: r-gone (e1), r-other (doanh nghiệp e2) */
const trashed: Record<string, { employerId: string; name: string }> = {
  'r-gone': { employerId: 'e1', name: 'Lê Văn Bình' },
  'r-other': { employerId: 'e2', name: 'Người Khác' },
};

describe('Thùng rác NTD /employer/trash (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  // Chạy callback của transaction tương tác trên chính mock prisma
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  let prismaMock: unknown;
  const restoreUpdate = vi.fn(async () => ({ count: 1 }));

  beforeAll(async () => {
    const prisma = {
      recruiter: {
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({ companyAdmin: Object.values(actors).find((a) => a.recruiterId === where.id)!.companyAdmin })),
        findFirst: vi.fn(async ({ where }: { where: { id: string; employerId: string } }) => {
          const t = trashed[where.id];
          return t && t.employerId === where.employerId ? { id: where.id, name: t.name, userId: `u-${where.id}`, user: { deletedAt: null } } : null;
        }),
        count: vi.fn(async () => 1),
        update: vi.fn(),
        updateMany: restoreUpdate,
      },
      memberInvite: { count: vi.fn(async () => 0) },
      follow: { deleteMany: vi.fn() },
      user: { update: vi.fn() },
      session: { updateMany: vi.fn() },
      pushToken: { deleteMany: vi.fn() },
      $transaction: transaction,
    };
    prismaMock = prisma;
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [EmployerTrashController],
      providers: [
        AuthGuard,
        EmployerTrashService,
        { provide: EmployerJobTrashService, useValue: { count: vi.fn(async () => 0) } },
        { provide: EmployerContext, useValue: { resolve: vi.fn(async (userId: string) => ({ userId, ...actors[userId]!, verified: true })) } },
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
    await http().get('/api/v1/employer/trash').expect(401);
  });

  it('403 với vai trò ứng viên và với thành viên thường', async () => {
    await http().get('/api/v1/employer/trash').set('Authorization', await auth('seeker', 'u-s')).expect(403);
    await http().get('/api/v1/employer/trash/members').set('Authorization', await auth('employer', 'u-member')).expect(403);
  });

  it('NTD cá nhân mở được thùng rác (chỉ tin của mình) nhưng không có mục thành viên → 404', async () => {
    const solo = await auth('employer', 'u-solo');
    await http().get('/api/v1/employer/trash').set('Authorization', solo).expect(200);
    await http().get('/api/v1/employer/trash/members').set('Authorization', solo).expect(404);
  });

  it('404 khi khôi phục / xoá thành viên của doanh nghiệp khác', async () => {
    const a = await auth('employer', 'u-admin');
    await http().post('/api/v1/employer/trash/members/r-other/restore').set('Authorization', a).expect(404);
    await http().post('/api/v1/employer/trash/members/r-other/purge').set('Authorization', a).send({ confirm: 'Người Khác' }).expect(404);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('400 khi gõ sai tên xác nhận – không xoá', async () => {
    await http().post('/api/v1/employer/trash/members/r-gone/purge').set('Authorization', await auth('employer', 'u-admin')).send({ confirm: 'Le Van Binh' }).expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('400 khi gõ đúng chữ nhưng sai hoa / thường', async () => {
    await http().post('/api/v1/employer/trash/members/r-gone/purge').set('Authorization', await auth('employer', 'u-admin')).send({ confirm: 'lê văn bình' }).expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('xoá vĩnh viễn khi gõ đúng 100% tên', async () => {
    await http().post('/api/v1/employer/trash/members/r-gone/purge').set('Authorization', await auth('employer', 'u-admin')).send({ confirm: 'Lê Văn Bình' }).expect(204);
    expect(transaction).toHaveBeenCalledTimes(1);
    // Ẩn danh có điều kiện: đúng doanh nghiệp, còn trong thùng rác, chưa xoá
    expect(restoreUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'r-gone', employerId: 'e1', purgedAt: null }) }));
  });

  it('khôi phục thành viên', async () => {
    await http().post('/api/v1/employer/trash/members/r-gone/restore').set('Authorization', await auth('employer', 'u-admin')).expect(204);
    expect(restoreUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { leftAt: null, removedById: null } }));
  });
});
