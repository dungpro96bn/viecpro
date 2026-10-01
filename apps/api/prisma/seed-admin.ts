/**
 * Dữ liệu demo cho khu quản trị (gọi từ seed.ts). CHỈ dùng cho môi trường dev.
 * Số ngẫu nhiên dùng seed cố định để lần chạy nào cũng ra cùng kết quả.
 */
import { DEFAULT_ADMIN_ROLES, INDUSTRIES, PREFECTURES, PROGRAMS, REGION_OF_PREF, VN_PROVINCES, slugify, type Industry, type Program } from '@viecpro/shared';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { jobSearchText } from '../src/modules/jobs/job-query.js';
import { jobImage, rng } from './seed-jobs.js';

const DAY = 86400_000;

const LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
const MIDDLE = ['Thị', 'Văn', 'Minh', 'Thu', 'Đức', 'Ngọc', 'Quang', 'Hải'];
const FIRST = ['Lan', 'Hùng', 'Mai', 'Tuấn', 'Hà', 'Nam', 'Linh', 'Dũng', 'Trang', 'Phong', 'Yến', 'Khoa'];

interface Ctx {
  passwordHash: string;
  jobIds: string[];
  camcomId: string;
}

export async function seedAdmin(prisma: PrismaClient, ctx: Ctx) {
  const rand = rng(20261001);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const now = Date.now();

  /* ---------- Vai trò & tài khoản quản trị ---------- */
  const roles: Record<string, string> = {};
  for (const r of DEFAULT_ADMIN_ROLES) {
    const role = await prisma.adminRole.create({ data: { key: r.key, name: r.name, description: r.description, permissions: [...r.permissions], isSystem: true } });
    roles[r.key] = role.id;
  }
  // 2FA bật ở lần đăng nhập đầu tiên (quét QR)
  const superAdmin = await prisma.user.create({
    data: { role: 'admin', name: 'Lê Hoàng Nam', email: 'admin@viecpro.vn', passwordHash: ctx.passwordHash, adminRoleId: roles.super_admin },
  });
  const moderator = await prisma.user.create({
    data: { role: 'admin', name: 'Thu Trang', email: 'kiemduyet@viecpro.vn', passwordHash: ctx.passwordHash, adminRoleId: roles.moderator },
  });

  /* ---------- Doanh nghiệp chưa xác minh ---------- */
  const companies = [
    { key: 'donga', name: 'Công ty CP Đông Á Nhân Lực', short: 'Đông Á Nhân Lực', ageDays: 210 },
    { key: 'nexa', name: 'Nexa Japan HR Co., Ltd.', short: 'Nexa Japan HR', ageDays: 120 },
    { key: 'minhphat', name: 'Công ty TNHH Minh Phát Global', short: 'Minh Phát Global', ageDays: 400 },
    { key: 'saomai', name: 'Sao Mai Group', short: 'Sao Mai Group', ageDays: 4 },
    { key: 'hoanglong', name: 'Công ty CP Hoàng Long', short: 'Hoàng Long JSC', ageDays: 15 },
  ];
  const employer: Record<string, { id: string; recruiterId: string }> = {};
  for (const c of companies) {
    const createdAt = new Date(now - c.ageDays * DAY);
    const e = await prisma.employer.create({ data: { slug: slugify(c.short), name: c.name, shortName: c.short, createdAt, verified: c.key === 'minhphat' } });
    const r = await prisma.recruiter.create({ data: { slug: `${slugify(c.short)}-tuyen-dung`, name: `Phòng tuyển dụng ${c.short}`, title: 'Cán bộ tuyển dụng', employerId: e.id, createdAt } });
    employer[c.key] = { id: e.id, recruiterId: r.id };
  }

  /* ---------- Tin chờ duyệt (hàng chờ kiểm duyệt) ---------- */
  const pending: Array<[string, string, string, Program, string, number, number, number]> = [
    // [DN, tiêu đề, tỉnh, chương trình, ngành, lương, số lượng, phút đã chờ]
    ['donga', 'Tuyển 12 nam cốp pha, cốt thép tại Aichi', 'Aichi', 'tts', 'Xây dựng', 186000, 12, 108],
    ['nexa', 'Kỹ sư điện – điện tử bảo trì dây chuyền Kanagawa', 'Kanagawa', 'ks', 'Cơ khí', 410000, 4, 96],
    ['minhphat', 'Kỹ năng đặc định: 04 nam đầu bếp món Nhật tại Kyoto', 'Kyoto', 'tok', 'Nhà hàng – Khách sạn', 224000, 4, 79],
    ['saomai', 'Tuyển 30 nữ đóng gói thực phẩm tại Hokkaido', 'Hokkaido', 'tts', 'Chế biến thực phẩm', 176000, 30, 55],
    ['camcom', 'Kỹ năng đặc định: 15 nữ điều dưỡng tại Nagoya', 'Aichi', 'tok', 'Điều dưỡng – Kaigo', 212000, 15, 28],
    ['hoanglong', 'Tuyển 06 nam lái máy xúc, máy công trình tại Chiba', 'Chiba', 'tts', 'Xây dựng', 188000, 8, 10],
  ];
  const camcomRecruiter = await prisma.recruiter.findFirstOrThrow({ where: { employerId: ctx.camcomId }, select: { id: true } });
  const pendingJobIds: Record<string, string> = {};
  for (const [i, [who, title, pref, program, industry, salary, quantity, waited]] of pending.entries()) {
    const number = 10300 + i;
    const code = `VP-${number}`;
    const owner = who === 'camcom' ? { id: ctx.camcomId, recruiterId: camcomRecruiter.id } : employer[who]!;
    const job = await prisma.job.create({
      data: {
        code,
        slug: `${slugify(title)}-${number}`,
        title,
        searchText: jobSearchText({ title, pref, industry, code }),
        imageUrl: jobImage(industry as Industry, rand()),
        pref,
        region: REGION_OF_PREF[pref]!,
        program,
        industry,
        salary,
        quantity,
        gender: title.includes('nữ') ? 'nu' : 'nam',
        birthYearFrom: 1990,
        birthYearTo: 2005,
        status: 'pending',
        submittedAt: new Date(now - waited * 60_000),
        recruiterId: owner.recruiterId,
        employerId: owner.id,
      },
    });
    pendingJobIds[who] = job.id;
  }

  /* ---------- Tin đã duyệt trong 60 ngày (thời gian duyệt TB) ---------- */
  const moderatedIds = ctx.jobIds;
  for (const [i, id] of moderatedIds.entries()) {
    const moderatedAt = new Date(now - (i * 3 + 1) * DAY + rand() * 6 * 3600_000);
    const minutes = 18 + Math.round(rand() * 34) + (i < 6 ? 10 : 0);
    await prisma.job.update({
      where: { id },
      data: { submittedAt: new Date(moderatedAt.getTime() - minutes * 60_000), moderatedAt, moderatedById: i % 3 ? moderator.id : superAdmin.id },
    });
  }

  /* ---------- Hồ sơ xác minh ---------- */
  const doc = (key: string, label: string, ok: boolean) => ({ key, label, ok });
  const individual = await prisma.recruiter.create({ data: { slug: 'nguyen-van-binh-ctv', name: 'Nguyễn Văn Bình', title: 'Cộng tác viên tuyển dụng', city: 'Nghệ An' } });
  const verifications = [
    { kind: 'company', employerId: employer.saomai!.id, idMasked: '0109•••482', location: 'Hà Nội', documents: [doc('dkkd', 'ĐKKD', true), doc('gpxkld', 'GP XKLĐ', true), doc('cccd', 'CCCD đại diện', true)], ageH: 30 },
    { kind: 'company', employerId: employer.hoanglong!.id, idMasked: '0316•••907', location: 'TP.HCM', documents: [doc('dkkd', 'ĐKKD', true), doc('gpxkld', 'GP XKLĐ', false), doc('cccd', 'CCCD đại diện', true)], ageH: 20 },
    { kind: 'individual', recruiterId: individual.id, idMasked: '•••• 4821', location: 'Nghệ An', documents: [doc('cccd', 'CCCD', true), doc('photo', 'Ảnh chân dung', true), doc('contract', 'Hợp đồng CTV', true)], ageH: 12 },
    { kind: 'company', employerId: employer.donga!.id, idMasked: '0107•••215', location: 'Hà Nội', documents: [doc('dkkd', 'ĐKKD', true), doc('gpxkld', 'GP XKLĐ', false), doc('cccd', 'CCCD đại diện', false)], ageH: 8 },
    { kind: 'company', employerId: employer.nexa!.id, idMasked: '0315•••660', location: 'TP.HCM', documents: [doc('dkkd', 'ĐKKD', true), doc('gpxkld', 'GP XKLĐ', true), doc('cccd', 'CCCD đại diện', false)], ageH: 5 },
  ];
  for (const { ageH, ...v } of verifications) {
    await prisma.verificationRequest.create({ data: { ...v, createdAt: new Date(now - ageH * 3600_000) } });
  }

  /* ---------- Báo cáo vi phạm ---------- */
  const reporters = await prisma.user.findMany({ where: { role: 'seeker' }, select: { id: true }, take: 3 });
  const reports = [
    ...[0, 1, 2].map((i) => ({ employerId: employer.donga!.id, jobId: pendingJobIds.donga, reason: 'Thu phí ngoài hợp đồng', detail: 'Yêu cầu nộp thêm "phí giữ chỗ" 500 USD', minutesAgo: 12 + i * 40, reporterId: reporters[i]?.id })),
    { employerId: employer.nexa!.id, jobId: pendingJobIds.nexa, reason: 'Tin trùng lặp, sai lương', detail: 'Kỹ sư cơ khí Osaka – 2 bản', minutesAgo: 60, reporterId: undefined },
    { employerId: employer.saomai!.id, jobId: pendingJobIds.saomai, reason: 'Ảnh không đúng thực tế', detail: 'Thực phẩm Hokkaido', minutesAgo: 180, reporterId: undefined },
  ];
  for (const { minutesAgo, ...r } of reports) {
    await prisma.report.create({ data: { ...r, createdAt: new Date(now - minutesAgo * 60_000) } });
  }

  /* ---------- Người dùng hoạt động (phiên) + ứng tuyển 60 ngày ---------- */
  const seekers = Array.from({ length: 400 }, (_, i) => ({
    role: 'seeker' as const,
    name: `${pick(LAST)} ${pick(MIDDLE)} ${pick(FIRST)}`,
    phone: `+849${String(10_000_000 + i * 2_347).padStart(8, '0')}`,
    passwordHash: ctx.passwordHash,
    phoneVerifiedAt: new Date(now - (60 + i) * DAY),
    createdAt: new Date(now - (60 + i) * DAY),
  }));
  await prisma.user.createMany({ data: seekers });
  const seekerRows = await prisma.user.findMany({ where: { phone: { in: seekers.map((s) => s.phone) } }, select: { id: true, name: true, phone: true } });

  // Hồ sơ ứng viên (tuổi 19 – 38, 55% nữ) – để "ứng viên phù hợp" ở trang Đăng tin và gợi ý việc làm có số thật
  const thisYear = new Date(now).getFullYear();
  await prisma.seekerProfile.createMany({
    data: seekerRows.map((u) => {
      const programs: Program[] = rand() < 0.7 ? ['tts'] : rand() < 0.75 ? ['tok'] : ['tts', 'tok'];
      if (rand() < 0.08) programs.push('ks');
      return {
        userId: u.id,
        birthYear: thisYear - 19 - Math.floor(rand() * 20),
        gender: rand() < 0.55 ? ('nu' as const) : ('nam' as const),
        hometown: pick(VN_PROVINCES),
        programs,
        industries: [...new Set([pick(INDUSTRIES), pick(INDUSTRIES)])],
        prefs: [...new Set([pick(PREFECTURES), pick(PREFECTURES), pick(PREFECTURES)])],
        lookingForJob: rand() < 0.88,
        heightCm: 150 + Math.floor(rand() * 28),
        weightKg: 44 + Math.floor(rand() * 30),
        jlpt: rand() < 0.25 ? pick(['N5', 'N4', 'N3']) : null,
      };
    }),
  });

  const sessions = [];
  for (let d = 0; d < 60; d++) {
    // Người dùng hoạt động tăng dần theo thời gian
    const active = Math.round(110 + (60 - d) * 1.6 + rand() * 30);
    for (let k = 0; k < active; k++) {
      const u = seekerRows[Math.floor(rand() * seekerRows.length)]!;
      const at = new Date(now - d * DAY - rand() * DAY * 0.9);
      sessions.push({
        userId: u.id,
        refreshTokenHash: `seed-${d}-${k}-${u.id}`,
        platform: rand() < 0.62 ? (rand() < 0.5 ? ('ios' as const) : ('android' as const)) : ('web' as const),
        createdAt: at,
        lastUsedAt: at,
        expiresAt: new Date(at.getTime() + 30 * DAY),
        revokedAt: new Date(at.getTime() + DAY),
      });
    }
  }
  await prisma.session.createMany({ data: sessions });

  const allJobIds = ctx.jobIds;
  const apps = [];
  for (let d = 0; d < 60; d++) {
    const weekday = new Date(now - d * DAY).getDay();
    const count = Math.round((weekday === 0 ? 45 : weekday === 6 ? 60 : 85) + (60 - d) * 0.6 + rand() * 25);
    for (let k = 0; k < count; k++) {
      const oneTap = rand() < 0.71;
      const u = seekerRows[Math.floor(rand() * seekerRows.length)]!;
      const roll = rand();
      // Hồ sơ càng cũ càng tiến xa trong quy trình
      const status = d > 7 && roll < 0.06 ? 'passed' : d > 3 && roll < 0.2 ? 'interview' : roll < 0.35 ? 'viewed' : roll < 0.4 ? 'rejected' : 'submitted';
      apps.push({
        jobId: allJobIds[Math.floor(rand() * allJobIds.length)]!,
        userId: oneTap ? u.id : null,
        fullName: oneTap ? u.name : `${pick(LAST)} ${pick(MIDDLE)} ${pick(FIRST)}`,
        phone: oneTap ? u.phone! : `+849${String(Math.floor(rand() * 89_999_999) + 10_000_000)}`,
        birthYear: 1990 + Math.floor(rand() * 15),
        gender: rand() < 0.55 ? ('nu' as const) : ('nam' as const),
        status: status as 'submitted' | 'viewed' | 'interview' | 'passed' | 'rejected',
        createdAt: new Date(now - d * DAY - rand() * DAY * 0.95),
      });
    }
  }
  await prisma.application.createMany({ data: apps });

  /* ---------- Nhận tin trong giờ qua + nhật ký kiểm duyệt ---------- */
  await prisma.subscription.createMany({
    data: Array.from({ length: 14 }, (_, i) => ({ contact: `nhantin${i}@example.com`, channel: i % 2 ? 'zalo' : 'email', createdAt: new Date(now - i * 4 * 60_000) })),
  });
  await prisma.auditLog.createMany({
    data: moderatedIds.slice(0, 3).map((id, i) => ({
      actorId: moderator.id,
      action: 'job.approve',
      targetType: 'job',
      targetId: id,
      after: { status: 'open' },
      createdAt: new Date(now - (9 + i * 20) * 60_000),
    })),
  });

  return { applications: apps.length, sessions: sessions.length };
}
