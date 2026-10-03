import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ConfigModule } from '../src/config/config.module.js';
import { AssetsModule } from '../src/core/assets/assets.module.js';
import { AuditModule } from '../src/core/audit/audit.service.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { AllExceptionsFilter } from '../src/core/http/all-exceptions.filter.js';
import { MailModule } from '../src/core/mail/mail.module.js';
import { PrismaModule } from '../src/core/prisma/prisma.module.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { EmployerPortalModule } from '../src/modules/employer-portal/employer-portal.module.js';
import { NotificationsModule } from '../src/modules/notifications/notifications.module.js';
import { ReportsModule } from '../src/modules/reports/reports.module.js';

/**
 * Cách ly dữ liệu giữa các NTD (RULE-BE.md mục 6 lớp 2, mục 14) – chạy service + Postgres thật, không mock truy vấn.
 * Cần database riêng: `npm run test:e2e:db` (tạo / migrate `viecpro_e2e` rồi chạy). Không có E2E_DATABASE_URL thì bỏ qua.
 *
 * Dữ liệu: công ty A (quản trị rA, thành viên rA2), công ty B (rB), NTD cá nhân rSolo đăng tin qua A (doanh nghiệp phái cử).
 * A không được thấy / sửa gì của B và của rSolo (dù tin rSolo mang employerId của A); ngược lại cũng vậy.
 */
const DB_URL = process.env.E2E_DATABASE_URL;
const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';

const ID = {
  eA: 'iso-emp-a',
  eB: 'iso-emp-b',
  uA: 'iso-user-a',
  uA2: 'iso-user-a2',
  uB: 'iso-user-b',
  uSolo: 'iso-user-solo',
  uSeeker: 'iso-user-seeker',
  rA: 'iso-rec-a',
  rA2: 'iso-rec-a2',
  rB: 'iso-rec-b',
  rSolo: 'iso-rec-solo',
  jA: 'iso-job-a',
  jA2: 'iso-job-a2',
  jB: 'iso-job-b',
  jSolo: 'iso-job-solo',
  aA: 'iso-app-a',
  aB: 'iso-app-b',
  aSolo: 'iso-app-solo',
  iA: 'iso-iv-a',
  iB: 'iso-iv-b',
  iSolo: 'iso-iv-solo',
  revA: 'iso-rev-a',
  revB: 'iso-rev-b',
  revSolo: 'iso-rev-solo',
  pSolo: 'iso-partner-solo',
  leadA: 'iso-lead-a',
  leadB: 'iso-lead-b',
  leadSolo: 'iso-lead-solo',
  leadA2: 'iso-lead-a2',
  leadJobA: 'iso-lead-job-a',
  leadJobSolo: 'iso-lead-job-solo',
  partnerApply: 'iso-partner-apply',
} as const;

async function resetDatabase(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  // Tên bảng lấy từ pg_tables (không phải dữ liệu người dùng); chỉ chạy trên database e2e
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}

async function seed(prisma: PrismaService) {
  const day = 86400_000;
  const future = new Date(Date.now() + 3 * day);
  const past = new Date(Date.now() - 2 * day);
  await prisma.employer.createMany({
    data: [
      { id: ID.eA, slug: 'iso-cong-ty-a', name: 'Công ty A', verified: true },
      { id: ID.eB, slug: 'iso-cong-ty-b', name: 'Công ty B', verified: true },
    ],
  });
  await prisma.user.createMany({
    data: [
      { id: ID.uA, role: 'employer', name: 'Quản trị A', phone: '+84900000101' },
      { id: ID.uA2, role: 'employer', name: 'Thành viên A', phone: '+84900000102' },
      { id: ID.uB, role: 'employer', name: 'Quản trị B', phone: '+84900000201' },
      { id: ID.uSolo, role: 'employer', name: 'NTD cá nhân', phone: '+84900000301' },
      { id: ID.uSeeker, role: 'seeker', name: 'Ứng viên', phone: '+84900000401' },
    ],
  });
  await prisma.recruiter.createMany({
    data: [
      { id: ID.rA, slug: 'iso-rec-a', userId: ID.uA, employerId: ID.eA, companyAdmin: true, name: 'Quản trị A', title: 'Quản trị' },
      { id: ID.rA2, slug: 'iso-rec-a2', userId: ID.uA2, employerId: ID.eA, name: 'Thành viên A', title: 'Cán bộ' },
      { id: ID.rB, slug: 'iso-rec-b', userId: ID.uB, employerId: ID.eB, companyAdmin: true, name: 'Quản trị B', title: 'Quản trị' },
      { id: ID.rSolo, slug: 'iso-rec-solo', userId: ID.uSolo, name: 'NTD cá nhân', title: 'Tư vấn viên' },
    ],
  });
  await prisma.recruiterPartner.create({ data: { id: ID.pSolo, recruiterId: ID.rSolo, employerId: ID.eA } });
  const job = (id: string, n: number, recruiterId: string, employerId: string | null) => ({
    id,
    code: `VP-ISO-${n}`,
    slug: `iso-job-${n}`,
    title: `Tin ${n}`,
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
    status: 'open' as const,
    publishedAt: past,
    recruiterId,
    employerId,
  });
  await prisma.job.createMany({ data: [job(ID.jA, 1, ID.rA, ID.eA), { ...job(ID.jA2, 4, ID.rA, ID.eA), status: 'paused' as const }, job(ID.jB, 2, ID.rB, ID.eB), job(ID.jSolo, 3, ID.rSolo, ID.eA)] });
  await prisma.businessPlan.create({ data: { employerId: ID.eA, name: 'Gói kiểm thử', jobQuota: 1, boostQuota: 0, expiresAt: future } });
  const app = (id: string, jobId: string, phone: string) => ({ id, jobId, fullName: `Ứng viên ${id}`, phone, birthYear: 2000, gender: 'nam' as const, status: 'submitted' as const });
  await prisma.application.createMany({ data: [app(ID.aA, ID.jA, '+84911000001'), app(ID.aB, ID.jB, '+84911000002'), app(ID.aSolo, ID.jSolo, '+84911000003')] });
  const interview = (id: string, ownerId: string, employerId: string | null, applicationId: string) =>
    prisma.interview.create({
      data: { id, kind: 'online', startAt: past, endAt: new Date(past.getTime() + 3600_000), ownerId, employerId, interviewers: { connect: [{ id: ownerId }] }, attendees: { create: [{ applicationId }] } },
    });
  await interview(ID.iA, ID.rA, ID.eA, ID.aA);
  await interview(ID.iB, ID.rB, ID.eB, ID.aB);
  await interview(ID.iSolo, ID.rSolo, null, ID.aSolo);
  await prisma.employerReview.createMany({
    data: [
      { id: ID.revA, applicationId: ID.aA, recruiterId: ID.rA, employerId: ID.eA, rating: 5, comment: 'Tư vấn tận tình, rõ ràng' },
      { id: ID.revB, applicationId: ID.aB, recruiterId: ID.rB, employerId: ID.eB, rating: 4, comment: 'Hỗ trợ nhanh, nhiệt tình' },
      { id: ID.revSolo, applicationId: ID.aSolo, recruiterId: ID.rSolo, employerId: ID.eA, rating: 3, comment: 'Bình thường, cần cải thiện' },
    ],
  });
  await prisma.lead.createMany({
    data: [
      { id: ID.leadA, name: 'Khách A', phone: '+84922000001', employerId: ID.eA },
      { id: ID.leadB, name: 'Khách B', phone: '+84922000002', employerId: ID.eB },
      { id: ID.leadSolo, name: 'Khách Solo', phone: '+84922000003', recruiterId: ID.rSolo },
      // Gửi riêng cho thành viên A2 (trang cán bộ) – quản trị A cũng phải thấy
      { id: ID.leadA2, name: 'Khách nhờ A2', phone: '+84922000004', recruiterId: ID.rA2 },
      // Chỉ có tin: thuộc chủ tin. Tin của NTD cá nhân mang employerId của A nhưng không thuộc A
      { id: ID.leadJobA, name: 'Khách tin A', phone: '+84922000005', jobId: ID.jA },
      { id: ID.leadJobSolo, name: 'Khách tin Solo', phone: '+84922000006', jobId: ID.jSolo },
    ],
  });
  return { future };
}

describe.skipIf(!DB_URL)('Cách ly dữ liệu giữa các NTD – Postgres thật (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let prisma: PrismaService;
  let future: Date;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: DB_URL,
      JWT_SECRET,
      OTP_SECRET: 'e2e-otp-secret-with-at-least-32-characters!!',
      ADMIN_MFA_KEY: 'e2e-admin-mfa-key-with-at-least-32-chars!!',
      JOB_ALERT_WORKER: 'false',
      REDIS_URL: '',
    });
    const module = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, AssetsModule, MailModule, AuditModule, NotificationsModule, ReportsModule, JwtModule.register({ global: true, secret: JWT_SECRET }), EmployerPortalModule],
      providers: [AuthGuard],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(module.get(AuthGuard));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    jwt = module.get(JwtService);
    prisma = module.get(PrismaService);
    await resetDatabase(prisma);
    ({ future } = await seed(prisma));
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = async (sub: string, role: 'seeker' | 'employer' = 'employer') => `Bearer ${await jwt.signAsync({ sub, role, sid: `${sub}-s` })}`;

  type Call = { method: 'get' | 'post' | 'patch'; path: (id: string) => string; body?: () => object };
  /** Route nhận id từ client – mỗi route phải: 401 chưa đăng nhập, 403 sai vai trò, 404 với dữ liệu của NTD khác */
  const routes: Record<string, Call> = {
    'GET hồ sơ ứng viên': { method: 'get', path: (id) => `/employer/applications/${id}` },
    'PATCH trạng thái hồ sơ': { method: 'patch', path: (id) => `/employer/applications/${id}/status`, body: () => ({ status: 'rejected' }) },
    'POST ghi chú hồ sơ': { method: 'post', path: (id) => `/employer/applications/${id}/notes`, body: () => ({ body: 'ghi chú lén' }) },
    'GET lịch phỏng vấn': { method: 'get', path: (id) => `/employer/interviews/${id}` },
    'PATCH dời lịch': { method: 'patch', path: (id) => `/employer/interviews/${id}`, body: () => ({ startAt: future.toISOString(), endAt: new Date(future.getTime() + 3600_000).toISOString() }) },
    'POST kết quả phỏng vấn': { method: 'post', path: (id) => `/employer/interviews/${id}/result`, body: () => ({ attendees: [{ applicationId: ID.aB, status: 'attended' }] }) },
    'POST huỷ lịch': { method: 'post', path: (id) => `/employer/interviews/${id}/cancel` },
    'GET form sửa tin': { method: 'get', path: (id) => `/employer/jobs/${id}/form` },
    'GET số liệu tin': { method: 'get', path: (id) => `/employer/jobs/${id}/stats` },
    'POST tạm ẩn tin': { method: 'post', path: (id) => `/employer/jobs/${id}/pause` },
    'POST đóng tin': { method: 'post', path: (id) => `/employer/jobs/${id}/close` },
    'POST đẩy tin': { method: 'post', path: (id) => `/employer/jobs/${id}/boost` },
    'POST xoá tin': { method: 'post', path: (id) => `/employer/jobs/${id}/delete` },
    'POST phản hồi đánh giá': { method: 'post', path: (id) => `/employer/reviews/${id}/respond`, body: () => ({ response: 'phản hồi lén' }) },
    'POST gia hạn liên kết đối tác': { method: 'post', path: (id) => `/employer/partners/${id}/renew` },
    'POST đánh dấu đã liên hệ khách': { method: 'post', path: (id) => `/employer/leads/${id}/handle` },
  };
  /** id thuộc B và thuộc NTD cá nhân, theo từng route */
  const foreign: Record<string, string[]> = {
    'GET hồ sơ ứng viên': [ID.aB, ID.aSolo],
    'PATCH trạng thái hồ sơ': [ID.aB, ID.aSolo],
    'POST ghi chú hồ sơ': [ID.aB, ID.aSolo],
    'GET lịch phỏng vấn': [ID.iB, ID.iSolo],
    'PATCH dời lịch': [ID.iB, ID.iSolo],
    'POST kết quả phỏng vấn': [ID.iB, ID.iSolo],
    'POST huỷ lịch': [ID.iB, ID.iSolo],
    'GET form sửa tin': [ID.jB, ID.jSolo],
    'GET số liệu tin': [ID.jB, ID.jSolo],
    'POST tạm ẩn tin': [ID.jB, ID.jSolo],
    'POST đóng tin': [ID.jB, ID.jSolo],
    'POST đẩy tin': [ID.jB, ID.jSolo],
    'POST xoá tin': [ID.jB, ID.jSolo],
    'POST phản hồi đánh giá': [ID.revB, ID.revSolo],
    'POST gia hạn liên kết đối tác': [ID.pSolo],
    'POST đánh dấu đã liên hệ khách': [ID.leadB, ID.leadSolo, ID.leadJobSolo],
  };
  const send = (call: Call, id: string, auth?: string) => {
    let req = http()[call.method](`/api/v1${call.path(id)}`);
    if (auth) req = req.set('Authorization', auth);
    return call.body ? req.send(call.body()) : req;
  };

  it('401 khi chưa đăng nhập, 403 với tài khoản ứng viên – mọi route', async () => {
    const seeker = await bearer(ID.uSeeker, 'seeker');
    for (const [name, call] of Object.entries(routes)) {
      const id = foreign[name]![0]!;
      expect((await send(call, id)).status, `${name} – 401`).toBe(401);
      expect((await send(call, id, seeker)).status, `${name} – 403`).toBe(403);
    }
  });

  it('404 khi công ty A thao tác trên dữ liệu của công ty B và của NTD cá nhân đăng qua A', async () => {
    const admin = await bearer(ID.uA);
    for (const [name, call] of Object.entries(routes)) {
      for (const id of foreign[name]!) {
        const res = await send(call, id, admin);
        expect(res.status, `${name} ${id}`).toBe(404);
        expect((res.body as { code: string }).code).toBe('NOT_FOUND');
      }
    }
  });

  it('404 khi NTD cá nhân thao tác trên dữ liệu của công ty A', async () => {
    const solo = await bearer(ID.uSolo);
    const own: Record<string, string> = {
      'GET hồ sơ ứng viên': ID.aA,
      'PATCH trạng thái hồ sơ': ID.aA,
      'GET lịch phỏng vấn': ID.iA,
      'POST huỷ lịch': ID.iA,
      'GET form sửa tin': ID.jA,
      'POST đóng tin': ID.jA,
      'POST phản hồi đánh giá': ID.revA,
      'POST đánh dấu đã liên hệ khách': ID.leadA2,
    };
    for (const [name, id] of Object.entries(own)) expect((await send(routes[name]!, id, solo)).status, name).toBe(404);
  });

  it('thao tác bị chặn không làm thay đổi dữ liệu của bên khác', async () => {
    const [aB, aSolo, iB, jB, jSolo, revB, notes, partner] = await Promise.all([
      prisma.application.findUniqueOrThrow({ where: { id: ID.aB } }),
      prisma.application.findUniqueOrThrow({ where: { id: ID.aSolo } }),
      prisma.interview.findUniqueOrThrow({ where: { id: ID.iB } }),
      prisma.job.findUniqueOrThrow({ where: { id: ID.jB } }),
      prisma.job.findUniqueOrThrow({ where: { id: ID.jSolo } }),
      prisma.employerReview.findUniqueOrThrow({ where: { id: ID.revB } }),
      prisma.applicationNote.count(),
      prisma.recruiterPartner.findUniqueOrThrow({ where: { id: ID.pSolo } }),
    ]);
    expect(aB.status).toBe('submitted');
    expect(aSolo.status).toBe('submitted');
    expect(iB.status).toBe('scheduled');
    expect(jB).toMatchObject({ status: 'open', deletedAt: null, boostedAt: null });
    expect(jSolo).toMatchObject({ status: 'open', deletedAt: null });
    expect(revB.response).toBeNull();
    expect(notes).toBe(0);
    expect(partner.renewRequestedAt).toBeNull();
    expect(await prisma.lead.count({ where: { handledAt: { not: null } } })).toBe(0);
  });

  it('đối chứng: chủ sở hữu vẫn mở được dữ liệu của mình (404 ở trên là do phân quyền, không do thiếu dữ liệu)', async () => {
    const a = await bearer(ID.uA);
    const solo = await bearer(ID.uSolo);
    await http().get(`/api/v1/employer/applications/${ID.aA}`).set('Authorization', a).expect(200);
    await http().get(`/api/v1/employer/interviews/${ID.iA}`).set('Authorization', a).expect(200);
    await http().get(`/api/v1/employer/jobs/${ID.jA}/stats`).set('Authorization', a).expect(200);
    await http().get(`/api/v1/employer/applications/${ID.aSolo}`).set('Authorization', solo).expect(200);
    await http().get(`/api/v1/employer/jobs/${ID.jSolo}/stats`).set('Authorization', solo).expect(200);
    await http().get(`/api/v1/employer/interviews/${ID.iSolo}`).set('Authorization', solo).expect(200);
  });

  it('danh sách chỉ chứa dữ liệu của chính NTD (kể cả khi lọc theo id của bên khác)', async () => {
    const a = await bearer(ID.uA);
    const ids = (body: unknown) => (body as { items: Array<{ id: string }> }).items.map((i) => i.id);

    const apps = await http().get('/api/v1/employer/applications').set('Authorization', a).expect(200);
    expect(ids(apps.body)).toEqual([ID.aA]);
    const filtered = await http().get(`/api/v1/employer/applications?jobId=${ID.jB}`).set('Authorization', a).expect(200);
    expect(ids(filtered.body)).toEqual([]);

    const jobs = await http().get('/api/v1/employer/jobs?tab=visible').set('Authorization', a).expect(200);
    expect(ids(jobs.body).sort()).toEqual([ID.jA, ID.jA2].sort());

    const reviews = await http().get('/api/v1/employer/reviews').set('Authorization', a).expect(200);
    expect(ids(reviews.body)).toEqual([ID.revA]);

    const leads = await http().get('/api/v1/employer/leads').set('Authorization', a).expect(200);
    expect(ids(leads.body).sort()).toEqual([ID.leadA, ID.leadA2, ID.leadJobA].sort());
    const soloLeads = await http().get('/api/v1/employer/leads').set('Authorization', await bearer(ID.uSolo)).expect(200);
    expect(ids(soloLeads.body).sort()).toEqual([ID.leadJobSolo, ID.leadSolo].sort());

    const from = new Date(Date.now() - 7 * 86400_000).toISOString();
    const to = new Date(Date.now() + 7 * 86400_000).toISOString();
    const week = await http().get(`/api/v1/employer/interviews?from=${from}&to=${to}`).set('Authorization', a).expect(200);
    expect(JSON.stringify(week.body)).toContain(ID.iA);
    expect(JSON.stringify(week.body)).not.toContain(ID.iB);
    expect(JSON.stringify(week.body)).not.toContain(ID.iSolo);

    const team = await http().get('/api/v1/employer/team').set('Authorization', a).expect(200);
    expect((team.body as Array<{ id: string }>).map((m) => m.id).sort()).toEqual([ID.rA, ID.rA2].sort());

    const report = await http().get('/api/v1/employer/reports?range=30').set('Authorization', a).expect(200);
    expect((report.body as { totalApplications: number }).totalApplications).toBe(1);
  });

  it('không mượn được ứng viên / người phỏng vấn của bên khác khi tạo lịch hẹn', async () => {
    const a = await bearer(ID.uA);
    const base = { kind: 'online', startAt: future.toISOString(), durationMinutes: 60, platform: 'zoom', meetingUrl: 'https://zoom.us/j/1', channels: [], remind24h: false, remind2h: false };
    const foreignApplicant = await http().post('/api/v1/employer/interviews').set('Authorization', a).send({ ...base, applicationIds: [ID.aB], interviewerIds: [ID.rA] });
    expect(foreignApplicant.status).toBe(404);
    const foreignInterviewer = await http().post('/api/v1/employer/interviews').set('Authorization', a).send({ ...base, applicationIds: [ID.aA], interviewerIds: [ID.rB] });
    expect(foreignInterviewer.status).toBe(400);
    expect(await prisma.interview.count()).toBe(3);
  });

  it('thành viên thường của A thấy tin của A nhưng không thấy tin NTD cá nhân đăng qua A', async () => {
    const member = await bearer(ID.uA2);
    await http().get(`/api/v1/employer/applications/${ID.aA}`).set('Authorization', member).expect(200);
    await http().get(`/api/v1/employer/applications/${ID.aSolo}`).set('Authorization', member).expect(404);
  });

  it('không mở lại tin vượt hạn mức gói', async () => {
    const admin = await bearer(ID.uA);
    const response = await http().post(`/api/v1/employer/jobs/${ID.jA2}/resume`).set('Authorization', admin);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PLAN_LIMIT');
    expect((await prisma.job.findUniqueOrThrow({ where: { id: ID.jA2 } })).status).toBe('paused');
  });

  it('quản trị A chỉ đọc được hồ sơ đối tác, che liên hệ và ghi lượt xem; thành viên/B bị chặn', async () => {
    const admin = await bearer(ID.uA);
    const member = await bearer(ID.uA2);
    const companyB = await bearer(ID.uB);
    await http().get(`/api/v1/employer/partner-jobs/${ID.jSolo}/applications`).expect(401);
    await http().get('/api/v1/employer/partner-jobs').set('Authorization', await bearer(ID.uSeeker, 'seeker')).expect(403);
    await http().get(`/api/v1/employer/partner-jobs/${ID.jSolo}/applications`).set('Authorization', member).expect(403);
    await http().get(`/api/v1/employer/partner-jobs/${ID.jSolo}/applications`).set('Authorization', companyB).expect(404);
    await http().get(`/api/v1/employer/partner-jobs/${ID.jSolo}/applications`).set('Authorization', admin).expect(200);

    const hidden = await http().get(`/api/v1/employer/partner-applications/${ID.aSolo}`).set('Authorization', admin).expect(200);
    expect(hidden.body).toMatchObject({ contactMasked: true, phone: '0911 xxx 003', email: null, address: null });
    expect(await prisma.partnerView.count({ where: { applicationId: ID.aSolo } })).toBe(1);
    const ownerDetail = await http().get(`/api/v1/employer/applications/${ID.aSolo}`).set('Authorization', await bearer(ID.uSolo)).expect(200);
    expect(ownerDetail.body.partnerViews).toHaveLength(1);

    await prisma.application.update({ where: { id: ID.aSolo }, data: { status: 'passed', email: 'candidate@example.com', address: 'Tokyo' } });
    const visible = await http().get(`/api/v1/employer/partner-applications/${ID.aSolo}`).set('Authorization', admin).expect(200);
    expect(visible.body).toMatchObject({ contactMasked: false, phone: '+84911000003', email: 'candidate@example.com', address: 'Tokyo' });
    await http().post(`/api/v1/employer/partner-jobs/${ID.jSolo}/report`).set('Authorization', admin).expect(201);
    expect(await prisma.report.count({ where: { jobId: ID.jSolo, reason: 'partner_request' } })).toBe(1);
    await http().patch(`/api/v1/employer/applications/${ID.aSolo}/status`).set('Authorization', admin).send({ status: 'rejected' }).expect(404);
  });

  it('khách cần tư vấn: cả doanh nghiệp thấy khách nhờ thành viên; đánh dấu đã liên hệ chỉ trong phạm vi', async () => {
    const member = await bearer(ID.uA2);
    const admin = await bearer(ID.uA);
    const tabs = await http().get('/api/v1/employer/leads?tab=unhandled').set('Authorization', member).expect(200);
    expect((tabs.body as { tabs: { unhandled: number; handled: number } }).tabs).toEqual({ unhandled: 3, handled: 0 });
    await http().post(`/api/v1/employer/leads/${ID.leadA2}/handle`).set('Authorization', admin).expect(204);
    // Bấm lại khi đã xử lý: không lỗi
    await http().post(`/api/v1/employer/leads/${ID.leadA2}/handle`).set('Authorization', member).expect(204);
    const handled = await http().get('/api/v1/employer/leads?tab=handled').set('Authorization', member).expect(200);
    expect((handled.body as { items: Array<{ id: string }> }).items.map((l) => l.id)).toEqual([ID.leadA2]);
    expect(await prisma.lead.count({ where: { handledAt: { not: null } } })).toBe(1);
  });
});
