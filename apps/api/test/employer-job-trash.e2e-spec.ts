import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AssetUrlService } from '../src/core/assets/asset-url.service.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { EmployerContext } from '../src/modules/employer-portal/employer-context.service.js';
import { EmployerJobFormService } from '../src/modules/employer-portal/employer-job-form.service.js';
import { EmployerJobTrashService } from '../src/modules/employer-portal/employer-job-trash.service.js';
import { EmployerJobsController } from '../src/modules/employer-portal/employer-jobs.controller.js';
import { EmployerJobsService } from '../src/modules/employer-portal/employer-jobs.service.js';
import { EmployerTrashController } from '../src/modules/employer-portal/employer-trash.controller.js';
import { EmployerTrashService } from '../src/modules/employer-portal/employer-trash.service.js';

const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';

const actors: Record<string, { recruiterId: string; employerId: string | null; companyAdmin: boolean }> = {
  'u-admin': { recruiterId: 'r-admin', employerId: 'e1', companyAdmin: true },
  'u-member': { recruiterId: 'r-member', employerId: 'e1', companyAdmin: false },
  'u-solo': { recruiterId: 'r-solo', employerId: null, companyAdmin: false },
};

interface JobRow { id: string; code: string; employerId: string | null; recruiterId: string; status: string; deletedAt: Date | null; purgedAt: Date | null }
type Where = Record<string, unknown> & { id?: string; employerId?: string; recruiterId?: string; status?: { in: string[] }; deletedAt?: null | { not: null }; purgedAt?: null };

/** Bộ lọc tối thiểu đủ để mô phỏng điều kiện sở hữu / trạng thái của Prisma */
function matches(job: JobRow, where: Where): boolean {
  if (where.id !== undefined && job.id !== where.id) return false;
  if (where.employerId !== undefined && job.employerId !== where.employerId) return false;
  if (where.recruiterId !== undefined && job.recruiterId !== where.recruiterId) return false;
  if (where.status?.in && !where.status.in.includes(job.status)) return false;
  if (where.deletedAt === null && job.deletedAt) return false;
  if (where.deletedAt && 'not' in where.deletedAt && !job.deletedAt) return false;
  if (where.purgedAt === null && job.purgedAt) return false;
  return true;
}

describe('Xoá tin & thùng rác tin /employer/jobs/:id/delete, /employer/trash/jobs (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let jobs: JobRow[];

  const reset = () => {
    jobs = [
      { id: 'j-closed', code: 'VP-1', employerId: 'e1', recruiterId: 'r-member', status: 'closed', deletedAt: null, purgedAt: null },
      { id: 'j-open', code: 'VP-2', employerId: 'e1', recruiterId: 'r-member', status: 'open', deletedAt: null, purgedAt: null },
      { id: 'j-other', code: 'VP-3', employerId: 'e2', recruiterId: 'r-x', status: 'closed', deletedAt: null, purgedAt: null },
      { id: 'j-other-trash', code: 'VP-4', employerId: 'e2', recruiterId: 'r-x', status: 'draft', deletedAt: new Date(), purgedAt: null },
      { id: 'j-solo', code: 'VP-5', employerId: null, recruiterId: 'r-solo', status: 'draft', deletedAt: null, purgedAt: null },
    ];
  };

  beforeAll(async () => {
    reset();
    const prisma: Record<string, unknown> = {
      job: {
        findFirst: vi.fn(async ({ where }: { where: Where }) => jobs.find((j) => matches(j, where)) ?? null),
        findMany: vi.fn(async ({ where }: { where: Where }) => jobs.filter((j) => matches(j, where)).map((j) => ({ ...j, deletedBy: null, _count: { applications: 0 } }))),
        count: vi.fn(async ({ where }: { where: Where }) => jobs.filter((j) => matches(j, where)).length),
        updateMany: vi.fn(async ({ where, data }: { where: Where; data: Partial<JobRow> }) => {
          const hit = jobs.filter((j) => matches(j, where));
          hit.forEach((j) => Object.assign(j, data));
          return { count: hit.length };
        }),
      },
      jobEvent: { create: vi.fn() },
      savedJob: { deleteMany: vi.fn() },
      recruiter: {
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({ companyAdmin: Object.values(actors).find((a) => a.recruiterId === where.id)!.companyAdmin })),
        count: vi.fn(async () => 0),
      },
    };
    prisma.$transaction = vi.fn(async (arg: unknown) => (typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(prisma) : Promise.all(arg as Promise<unknown>[])));

    const ownerScope = (a: { employerId: string | null; recruiterId: string }) => (a.employerId ? { employerId: a.employerId } : { recruiterId: a.recruiterId });
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [EmployerJobsController, EmployerTrashController],
      providers: [
        AuthGuard,
        EmployerJobTrashService,
        EmployerTrashService,
        { provide: EmployerJobsService, useValue: {} },
        { provide: EmployerJobFormService, useValue: {} },
        {
          provide: EmployerContext,
          useValue: {
            resolve: vi.fn(async (userId: string) => ({ userId, ...actors[userId]!, verified: true })),
            ownerScope,
            jobScope: (a: { employerId: string | null; recruiterId: string }) => ({ ...ownerScope(a), deletedAt: null }),
          },
        },
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

  beforeEach(reset);

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = async (role: 'seeker' | 'employer', sub: string) => `Bearer ${await jwt.signAsync({ sub, role, sid: `${sub}-s` })}`;
  const job = (id: string) => jobs.find((j) => j.id === id)!;

  it('401 khi chưa đăng nhập', async () => {
    await http().post('/api/v1/employer/jobs/j-closed/delete').expect(401);
    await http().get('/api/v1/employer/trash/jobs').expect(401);
  });

  it('403 với ứng viên; thành viên thường xoá được tin nhưng không mở được thùng rác', async () => {
    await http().post('/api/v1/employer/jobs/j-closed/delete').set('Authorization', await auth('seeker', 'u-s')).expect(403);
    const member = await auth('employer', 'u-member');
    await http().post('/api/v1/employer/jobs/j-closed/delete').set('Authorization', member).expect(204);
    expect(job('j-closed').deletedAt).toBeInstanceOf(Date);
    await http().get('/api/v1/employer/trash/jobs').set('Authorization', member).expect(403);
  });

  it('404 khi xoá / khôi phục / xoá vĩnh viễn tin của doanh nghiệp khác', async () => {
    const a = await auth('employer', 'u-admin');
    await http().post('/api/v1/employer/jobs/j-other/delete').set('Authorization', a).expect(404);
    await http().post('/api/v1/employer/trash/jobs/j-other-trash/restore').set('Authorization', a).expect(404);
    await http().post('/api/v1/employer/trash/jobs/j-other-trash/purge').set('Authorization', a).send({ confirm: 'VP-4' }).expect(404);
    expect(job('j-other').deletedAt).toBeNull();
    expect(job('j-other-trash').deletedAt).not.toBeNull();
    expect(job('j-other-trash').purgedAt).toBeNull();
    // Danh sách thùng rác không lộ tin doanh nghiệp khác
    const list = await http().get('/api/v1/employer/trash/jobs').set('Authorization', a).expect(200);
    expect((list.body as { items: Array<{ id: string }> }).items.map((i) => i.id)).not.toContain('j-other-trash');
  });

  it('409 khi xoá tin đang hiển thị', async () => {
    await http().post('/api/v1/employer/jobs/j-open/delete').set('Authorization', await auth('employer', 'u-admin')).expect(409);
    expect(job('j-open').deletedAt).toBeNull();
  });

  it('quản trị viên khôi phục tin, giữ nguyên trạng thái lúc xoá', async () => {
    const a = await auth('employer', 'u-admin');
    await http().post('/api/v1/employer/jobs/j-closed/delete').set('Authorization', a).expect(204);
    const list = await http().get('/api/v1/employer/trash/jobs').set('Authorization', a).expect(200);
    expect((list.body as { items: Array<{ id: string; confirmText: string }> }).items).toEqual([expect.objectContaining({ id: 'j-closed', confirmText: 'VP-1' })]);
    await http().post('/api/v1/employer/trash/jobs/j-closed/restore').set('Authorization', a).expect(204);
    expect(job('j-closed')).toMatchObject({ deletedAt: null, status: 'closed' });
  });

  it('xoá vĩnh viễn phải gõ đúng mã tin; NTD cá nhân dùng thùng rác của mình', async () => {
    const solo = await auth('employer', 'u-solo');
    await http().post('/api/v1/employer/jobs/j-solo/delete').set('Authorization', solo).expect(204);
    await http().post('/api/v1/employer/trash/jobs/j-solo/purge').set('Authorization', solo).send({ confirm: 'vp-5' }).expect(400);
    expect(job('j-solo').purgedAt).toBeNull();
    await http().post('/api/v1/employer/trash/jobs/j-solo/purge').set('Authorization', solo).send({ confirm: 'VP-5' }).expect(204);
    expect(job('j-solo').purgedAt).toBeInstanceOf(Date);
    // NTD cá nhân không có mục thành viên
    const summary = await http().get('/api/v1/employer/trash').set('Authorization', solo).expect(200);
    expect((summary.body as { categories: Array<{ key: string }> }).categories.map((c) => c.key)).toEqual(['jobs']);
  });
});
