/**
 * Dữ liệu demo khu nhà tuyển dụng (design 10 → 17) và tài khoản ứng viên (design 18 → 20).
 * Gọi từ seed.ts – CHỈ dùng cho môi trường dev. Số ngẫu nhiên có seed cố định.
 */
import { REGION_OF_PREF, slugify, type ApplicationStatus, type Gender } from '@viecpro/shared';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { jobSearchText } from '../src/modules/jobs/job-query.js';
import { rng } from './seed-jobs.js';

const DAY = 86400_000;
const HOUR = 3600_000;
const MIN = 60_000;

/** Doanh nghiệp đã xác minh nhận phần lớn đơn hàng loạt (tên xuất hiện ở design 18 – 20) */
const PARTNER_COMPANIES = [
  { name: 'Kyodo Koyo Japan Co., Ltd.', short: 'Kyodo Koyo Japan', logo: '/images/logos/logo-1.png', recruiter: 'Sato Yuki' },
  { name: 'Mirai Foods Hokkaido K.K.', short: 'Mirai Foods Hokkaido', logo: '/images/logos/logo-3.png', recruiter: 'Tanaka Haruto' },
  { name: 'Công ty CP Agri Link Việt Nhật', short: 'Agri Link Việt Nhật', logo: '/images/logos/logo-4.png', recruiter: 'Lê Văn Phúc' },
] as const;

export async function seedPartnerCompanies(prisma: PrismaClient) {
  for (const c of PARTNER_COMPANIES) {
    const e = await prisma.employer.create({ data: { slug: slugify(c.short), name: c.name, shortName: c.short, logoUrl: c.logo, verified: true } });
    await prisma.recruiter.create({ data: { slug: `${slugify(c.short)}-tuyen-dung`, name: c.recruiter, title: 'Cán bộ tuyển dụng', employerId: e.id, rating: 4.5 } });
  }
}

interface Ctx {
  /** 30 đơn chi tiết, đúng thứ tự ROWS trong seed.ts */
  jobIds: string[];
  recruiterIds: Record<string, string>;
  camcomId: string;
  seekerId: string;
}

/** [tên, giới tính, tuổi, quê, chỉ số đơn, nhãn, % phù hợp, trạng thái, phút trước] – khớp design 13 */
type ApplicantRow = [string, Gender, number, string, number, string[], number, ApplicationStatus, number];
const APPLICANTS: ApplicantRow[] = [
  ['Phạm Thu Trang', 'nu', 24, 'Thanh Hóa', 6, ['Thị lực tốt'], 91, 'submitted', 40],
  ['Phan Văn Đức', 'nam', 25, 'Quảng Bình', 16, ['N3', 'PHP'], 82, 'submitted', 180],
  ['Lê Thị Hoa', 'nu', 29, 'Hà Tĩnh', 3, ['N4', 'KN chăm sóc'], 88, 'submitted', 300],
  ['Trần Văn Nam', 'nam', 26, 'Nam Định', 0, ['KN xây dựng'], 84, 'submitted', 26 * 60],
  ['Lê Văn Tú', 'nam', 27, 'Thái Bình', 0, ['KN 2 năm'], 80, 'submitted', 30 * 60],
  ['Phạm Thị Nga', 'nu', 23, 'Hưng Yên', 6, ['Khéo tay'], 87, 'submitted', 33 * 60],
  ['Đinh Thị Hạnh', 'nu', 25, 'Hà Nam', 1, ['Có hộ chiếu'], 85, 'submitted', 38 * 60],
  ['Cao Văn Bình', 'nam', 29, 'Bắc Ninh', 16, ['N3', 'Java'], 77, 'submitted', 41 * 60],
  ['Vũ Thị Mai', 'nu', 22, 'Thái Bình', 1, ['Có hộ chiếu'], 90, 'viewed', 22 * 60],
  ['Trịnh Thị Hằng', 'nu', 26, 'Thanh Hóa', 3, ['N4', 'Có hộ chiếu'], 87, 'viewed', 23 * 60],
  ['Đỗ Minh Tuấn', 'nam', 28, 'Hải Dương', 16, ['N3', 'Java'], 79, 'viewed', 3 * 24 * 60],
  ['Hoàng Thị Ngọc', 'nu', 25, 'Bắc Giang', 6, ['Khéo tay', 'N5'], 93, 'interview', 4 * 24 * 60],
  ['Bùi Văn Hùng', 'nam', 30, 'Phú Thọ', 0, ['KN 3 năm'], 86, 'interview', 4 * 24 * 60 + 90],
  ['Lý Văn Khánh', 'nam', 27, 'Lạng Sơn', 0, ['KN 1 năm'], 81, 'interview', 5 * 24 * 60],
  ['Bùi Thị Hương', 'nu', 23, 'Hưng Yên', 1, ['N5'], 88, 'interview', 5 * 24 * 60 + 200],
  ['Ngô Thị Thảo', 'nu', 23, 'Nghệ An', 1, ['Đã khám SK'], 92, 'passed', 6 * 24 * 60],
  ['Mai Thị Yến', 'nu', 24, 'Ninh Bình', 6, ['Khéo tay'], 89, 'passed', 8 * 24 * 60],
  ['Đặng Văn Long', 'nam', 34, 'Hà Nam', 16, ['Quá tuổi đơn'], 58, 'rejected', 7 * 24 * 60],
];

const EXPERIENCE: Record<string, string> = {
  nam: '3 năm thợ xây dựng dân dụng, quen làm cốp pha, cốt thép',
  nu: '3 năm công nhân may, quen làm việc theo ca',
};
const STATUS_CHAIN: Record<string, ApplicationStatus[]> = {
  submitted: ['submitted'],
  viewed: ['submitted', 'viewed'],
  interview: ['submitted', 'viewed', 'interview'],
  passed: ['submitted', 'viewed', 'interview', 'passed'],
  rejected: ['submitted', 'viewed', 'rejected'],
};

export async function seedEmployerPortal(prisma: PrismaClient, ctx: Ctx) {
  const rand = rng(20261003);
  const now = Date.now();
  const today = (h: number, m = 0, addDays = 0) => {
    const d = new Date(now + addDays * DAY);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const { jobIds, recruiterIds: r, camcomId } = ctx;

  /* ---------- Thành viên, gói dịch vụ, doanh nghiệp phái cử ---------- */
  const long = await prisma.recruiter.create({ data: { slug: 'pham-duc-long', name: 'Phạm Đức Long', title: 'Cán bộ tuyển dụng', employerId: camcomId, rating: 4.5, city: 'Hà Nội' } });
  await prisma.businessPlan.createMany({
    data: [
      { employerId: camcomId, name: 'Gói Pro', jobQuota: 40, boostQuota: 60, boostsUsed: 34, expiresAt: new Date(now + 60 * DAY) },
      { recruiterId: r.ha!, name: 'Gói Cá nhân Plus', jobQuota: 10, boostQuota: 20, boostsUsed: 12, expiresAt: new Date(now + 75 * DAY) },
    ],
  });
  const minhPhat = await prisma.employer.findUniqueOrThrow({ where: { slug: 'minh-phat-global' }, select: { id: true } });
  const nexa = await prisma.employer.findUniqueOrThrow({ where: { slug: 'nexa-japan-hr' }, select: { id: true } });
  await prisma.recruiterPartner.createMany({
    data: [
      { recruiterId: r.ha!, employerId: minhPhat.id, expiresAt: new Date(now + 14 * DAY), departedCount: 21 },
      { recruiterId: r.ha!, employerId: camcomId, expiresAt: new Date(now + 200 * DAY), departedCount: 412 },
      { recruiterId: r.ha!, employerId: nexa.id, expiresAt: new Date(now + 120 * DAY), departedCount: 3 },
    ],
  });
  // 4 tin Thu Hà đăng qua Minh Phát Global
  const haJobs = [
    ['Tuyển 10 nữ đóng gói thực phẩm tại Chiba', 'Chiba', 'Chế biến thực phẩm', 'Đóng gói thực phẩm', 176000],
    ['Kỹ năng đặc định: 06 nam nữ phục vụ nhà hàng tại Tokyo', 'Tokyo', 'Nhà hàng – Khách sạn', 'Phục vụ nhà hàng', 212000],
    ['Kỹ năng đặc định: 04 nam phụ bếp nhà hàng tại Tokyo', 'Tokyo', 'Nhà hàng – Khách sạn', 'Phụ bếp nhà hàng', 208000],
    ['Tuyển 08 nữ lắp ráp linh kiện tại Gunma', 'Gunma', 'Điện tử – Lắp ráp', 'Lắp ráp linh kiện', 178000],
  ] as const;
  const maxCode = await prisma.job.aggregate({ _max: { code: true } });
  let number = Number(maxCode._max.code?.replace('VP-', '') ?? 10600) + 1;
  for (const [i, [title, pref, industry, position, salary]] of haJobs.entries()) {
    const code = `VP-${number}`;
    await prisma.job.create({
      data: {
        code,
        slug: `${slugify(title)}-${number}`,
        title,
        searchText: jobSearchText({ title, pref, industry, code }),
        imageUrl: `/images/jobs/job-${String([2, 6, 11, 7][i]!).padStart(2, '0')}.jpg`,
        pref,
        region: REGION_OF_PREF[pref]!,
        program: title.startsWith('Kỹ năng') ? 'tok' : 'tts',
        industry,
        position,
        salary,
        quantity: 6 + i * 2,
        gender: title.includes('nam nữ') ? 'both' : title.includes('nữ') ? 'nu' : 'nam',
        birthYearFrom: 1992,
        birthYearTo: 2006,
        views: 600 + i * 410,
        status: 'open',
        publishedAt: new Date(now - (3 + i * 4) * DAY),
        deadline: new Date(now + (20 + i * 9) * DAY),
        departureAt: new Date(now + (120 + i * 20) * DAY),
        feeUsd: 4200,
        contractYears: title.startsWith('Kỹ năng') ? 5 : 3,
        recruiterId: r.ha!,
        employerId: minhPhat.id,
      },
    });
    number += 1;
  }

  /* ---------- Bổ sung dữ liệu cho hồ sơ ứng tuyển hàng loạt (seed-admin) ---------- */
  await prisma.$transaction([
    prisma.$executeRaw`SELECT setseed(0.42)`,
    // Hồ sơ cũ hơn 3 giờ coi như đã liên hệ – giữ số "chưa liên hệ" thực tế
    prisma.$executeRaw`UPDATE "Application" SET status = 'viewed' WHERE status = 'submitted' AND "createdAt" < now() - interval '3 hours'`,
    // Phần lớn được gọi lại trong 30 phút (phân bố lệch về phía nhanh)
    prisma.$executeRaw`UPDATE "Application" SET "contactedAt" = "createdAt" + (3 + power(random(), 3) * 80) * interval '1 minute' WHERE status <> 'submitted' AND "contactedAt" IS NULL`,
    // Trúng tuyển không vượt quá nửa chỉ tiêu của đơn (dữ liệu hàng loạt ngẫu nhiên)
    prisma.$executeRaw`UPDATE "Application" a SET status = 'interview' FROM (SELECT a2.id, row_number() OVER (PARTITION BY a2."jobId" ORDER BY a2."createdAt") AS rn, j.quantity FROM "Application" a2 JOIN "Job" j ON j.id = a2."jobId" WHERE a2.status = 'passed') x WHERE x.id = a.id AND x.rn > GREATEST(1, x.quantity / 2)`,
    prisma.$executeRaw`UPDATE "Application" SET "seenAt" = COALESCE("contactedAt", "createdAt" + interval '20 minutes') WHERE status <> 'submitted'`,
    prisma.$executeRaw`UPDATE "Application" SET "matchScore" = 55 + floor(random() * 44)::int WHERE "matchScore" IS NULL`,
    prisma.$executeRaw`UPDATE "Application" SET tags = ARRAY[(ARRAY['Khéo tay','Thị lực tốt','N5','N4','Có hộ chiếu','KN 1 năm','KN 2 năm','Không hình xăm'])[1 + floor(random() * 8)::int]] WHERE tags IS NULL OR cardinality(tags) = 0`,
    prisma.$executeRaw`UPDATE "Application" SET passport = CASE WHEN 'Có hộ chiếu' = ANY(tags) THEN 'has' ELSE (ARRAY['has','processing','none','none'])[1 + floor(random() * 4)::int] END WHERE passport IS NULL`,
    prisma.$executeRaw`UPDATE "Application" SET hometown = (ARRAY['Nghệ An','Thanh Hóa','Hà Tĩnh','Nam Định','Thái Bình','Bắc Giang','Hải Dương','Phú Thọ','Ninh Bình','Quảng Bình'])[1 + floor(random() * 10)::int] WHERE hometown IS NULL`,
    prisma.$executeRaw`UPDATE "Application" a SET source = (CASE WHEN x.r < 0.46 THEN 'viecpro' WHEN x.r < 0.74 THEN 'recommended' WHEN x.r < 0.90 THEN 'zalo' ELSE 'consultant' END)::"ApplicationSource" FROM (SELECT id, random() AS r FROM "Application") x WHERE x.id = a.id`,
  ]);

  // Thu Hà: lao động đã xuất cảnh trong 30 ngày (KPI "Lao động đã bay")
  const haScope = { job: { recruiterId: r.ha! } };
  const departed = await prisma.application.findMany({ where: { ...haScope, status: 'viewed', createdAt: { lt: new Date(now - 40 * DAY) } }, take: 18, select: { id: true } });
  for (const [i, a] of departed.entries()) {
    const at = new Date(now - (1 + i * 1.6) * DAY);
    await prisma.application.update({ where: { id: a.id }, data: { status: 'departed', events: { create: [{ status: 'passed', createdAt: new Date(at.getTime() - 30 * DAY) }, { status: 'departed', createdAt: at }] } } });
  }

  /* ---------- Hồ sơ chi tiết (design 13) ---------- */
  const jobs = await prisma.job.findMany({ where: { id: { in: jobIds } }, select: { id: true, recruiterId: true, title: true } });
  const ownerOf = new Map(jobs.map((j) => [j.id, j.recruiterId]));
  const appIdByName: Record<string, string> = {};
  for (const [i, [fullName, gender, age, hometown, jobIndex, tags, match, status, minutesAgo]] of APPLICANTS.entries()) {
    const jobId = jobIds[jobIndex]!;
    const createdAt = new Date(now - minutesAgo * MIN);
    const chain = STATUS_CHAIN[status]!;
    const contactedAt = status === 'submitted' ? null : new Date(createdAt.getTime() + (8 + Math.round(rand() * 25)) * MIN);
    const slug = slugify(fullName).replace(/-/g, '');
    const app = await prisma.application.create({
      data: {
        jobId,
        fullName,
        phone: `+8491${String(2400000 + i * 7919).padStart(7, '0')}`,
        birthYear: new Date().getFullYear() - age,
        gender,
        hometown,
        status,
        tags,
        matchScore: match,
        heightCm: gender === 'nu' ? 152 + Math.round(rand() * 10) : 162 + Math.round(rand() * 12),
        weightKg: gender === 'nu' ? 45 + Math.round(rand() * 8) : 55 + Math.round(rand() * 15),
        maritalStatus: rand() < 0.7 ? 'single' : 'married',
        education: 'thpt',
        jlpt: tags.find((t) => /^N[1-5]$/.test(t)) ?? null,
        passport: tags.includes('Có hộ chiếu') ? 'has' : rand() < 0.4 ? 'processing' : 'none',
        departWithin: rand() < 0.6 ? '6' : '3',
        experience: EXPERIENCE[gender],
        source: (['viecpro', 'recommended', 'zalo', 'consultant'] as const)[i % 4],
        documents: [
          { name: `CV_${slug}.pdf`, kind: 'pdf', sizeKb: 180 + i * 7 },
          { name: 'Anh_ho_chieu.jpg', kind: 'image', sizeKb: 1100 + i * 13 },
        ],
        assigneeId: ownerOf.get(jobId) ?? null,
        seenAt: status === 'submitted' && i % 2 === 0 ? null : (contactedAt ?? createdAt),
        contactedAt,
        createdAt,
        events: {
          create: chain.map((s, k) => ({
            status: s,
            note: s === 'viewed' ? 'Cán bộ gọi điện xác nhận thông tin' : s === 'rejected' ? 'Quá tuổi đơn tuyển' : null,
            createdAt: new Date(createdAt.getTime() + k * 3 * HOUR),
          })),
        },
      },
    });
    appIdByName[fullName] = app.id;
  }
  await prisma.applicationNote.createMany({
    data: [
      { applicationId: appIdByName['Hoàng Thị Ngọc']!, authorId: r.ha!, body: 'Ứng viên nhanh nhẹn, muốn bay trước Tết. Đã gửi link Zoom.', createdAt: new Date(now - 2 * DAY) },
      { applicationId: appIdByName['Vũ Thị Mai']!, authorId: r.minhanh!, body: 'Đã gọi, hẹn gửi ảnh hộ chiếu trong tuần.', createdAt: new Date(now - 20 * HOUR) },
      { applicationId: appIdByName['Trần Văn Nam']!, authorId: r.minhanh!, body: 'Gọi 2 lần chưa nghe máy, thử lại buổi tối.', createdAt: new Date(now - 3 * HOUR) },
    ],
  });

  /* ---------- Ứng viên Lan: việc đã ứng tuyển (design 19) ---------- */
  const lan = await prisma.user.findUniqueOrThrow({ where: { id: ctx.seekerId }, select: { id: true, name: true, phone: true } });
  const lanApp = async (jobIndex: number, status: ApplicationStatus, days: number[], notes: Array<string | null>, extra: { interviewAt?: Date } = {}) => {
    const chain = (status === 'rejected' ? ['submitted', 'viewed', 'rejected'] : STATUS_CHAIN[status] ?? ['submitted']) as ApplicationStatus[];
    const app = await prisma.application.create({
      data: {
        jobId: jobIds[jobIndex]!,
        userId: lan.id,
        fullName: lan.name,
        phone: lan.phone!,
        birthYear: 1999,
        gender: 'nu',
        hometown: 'Nghệ An',
        status,
        tags: ['Khéo tay', 'Có hộ chiếu'],
        matchScore: 96,
        heightCm: 158,
        weightKg: 50,
        maritalStatus: 'single',
        education: 'thpt',
        passport: 'processing',
        departWithin: '6',
        experience: '3 năm công nhân may',
        documents: [{ name: 'CV_NguyenThiLan.pdf', kind: 'pdf', sizeKb: 248 }, { name: 'Anh_ho_chieu.jpg', kind: 'image', sizeKb: 1200 }],
        assigneeId: ownerOf.get(jobIds[jobIndex]!) ?? null,
        seenAt: status === 'submitted' ? null : new Date(now - days[1]! * DAY),
        contactedAt: chain.length > 1 ? new Date(now - days[1]! * DAY) : null,
        createdAt: new Date(now - days[0]! * DAY),
        interviewAt: extra.interviewAt,
        events: { create: chain.map((s, k) => ({ status: s, note: notes[k] ?? null, createdAt: new Date(now - (days[k] ?? 0) * DAY) })) },
      },
    });
    return app.id;
  };
  const lanInterviewAt = today(10, 0, 1);
  const lanSaitama = await lanApp(6, 'interview', [6, 5.6, 1.4], ['Ứng tuyển 1 chạm từ viecpro', 'Cán bộ gọi điện xác nhận thông tin', 'Hẹn phỏng vấn online 10:00 – Chào Lan, phỏng vấn online 10:00 nhé. Em chuẩn bị giới thiệu bản thân bằng tiếng Nhật khoảng 1 phút, chị gửi link Zoom qua Zalo.'], { interviewAt: lanInterviewAt });
  await lanApp(9, 'passed', [29, 28, 16, 9], ['Ứng tuyển 1 chạm từ viecpro', null, null, 'Chúc mừng bạn! Khám sức khoẻ trước 05/10']);
  await lanApp(1, 'viewed', [4, 1], ['Ứng tuyển 1 chạm từ viecpro', 'Dự kiến phỏng vấn giữa tháng 10']);
  await lanApp(3, 'submitted', [3], ['Ứng tuyển 1 chạm từ viecpro']);
  await lanApp(2, 'rejected', [19, 18, 18], ['Ứng tuyển 1 chạm từ viecpro', null, 'Chưa phù hợp tiêu chí chiều cao của xí nghiệp']);

  /* ---------- Lịch phỏng vấn tuần này (design 14) ---------- */
  type Slot = { kind: 'online' | 'onsite' | 'skill_test'; start: Date; minutes: number; apps: string[]; owner: string; interviewers: string[]; status?: 'pending' | 'confirmed' | 'attended' | 'no_show'; location?: string; partner?: string };
  const id = (name: string) => appIdByName[name]!;
  const mass = await prisma.application.findMany({ where: { jobId: jobIds[6], status: 'viewed' }, take: 3, select: { id: true } });
  const slots: Slot[] = [
    { kind: 'online', start: today(9, 0, -2), minutes: 60, apps: [id('Đỗ Minh Tuấn')], owner: r.minhanh!, interviewers: [r.minhanh!], status: 'attended' },
    { kind: 'online', start: today(10, 0, -1), minutes: 60, apps: [id('Vũ Thị Mai')], owner: r.ha!, interviewers: [r.ha!], status: 'attended' },
    { kind: 'skill_test', start: today(14, 0, -2), minutes: 90, apps: mass.slice(0, 2).map((m) => m.id), owner: r.minhanh!, interviewers: [r.minhanh!, long.id], status: 'attended', location: 'Xưởng test Saitama' },
    { kind: 'onsite', start: today(15, 0, -1), minutes: 60, apps: [id('Lý Văn Khánh')], owner: r.minhanh!, interviewers: [long.id], status: 'no_show', location: 'Văn phòng Hà Nội' },
    { kind: 'online', start: today(10, 0), minutes: 60, apps: [id('Hoàng Thị Ngọc')], owner: r.ha!, interviewers: [r.ha!], status: 'confirmed' },
    { kind: 'onsite', start: today(14, 30), minutes: 60, apps: [id('Bùi Văn Hùng')], owner: r.minhanh!, interviewers: [r.minhanh!], status: 'confirmed', location: 'Văn phòng Hà Nội' },
    { kind: 'skill_test', start: today(16, 0), minutes: 90, apps: [id('Mai Thị Yến'), id('Phạm Thu Trang'), ...mass.slice(0, 2).map((m) => m.id)], owner: r.minhanh!, interviewers: [r.minhanh!, long.id], status: 'confirmed', location: 'Xưởng test', partner: 'Kenji Sato – xí nghiệp Saitama' },
    { kind: 'online', start: today(9, 0, 1), minutes: 60, apps: [id('Lê Thị Hoa')], owner: r.minhanh!, interviewers: [long.id], status: 'pending' },
    { kind: 'onsite', start: today(9, 30, 1), minutes: 60, apps: [id('Trịnh Thị Hằng')], owner: r.minhanh!, interviewers: [r.minhanh!], status: 'pending', location: 'Văn phòng Hà Nội' },
    { kind: 'online', start: lanInterviewAt, minutes: 60, apps: [lanSaitama], owner: r.ha!, interviewers: [r.ha!], status: 'confirmed', partner: 'Kenji Sato – xí nghiệp Saitama' },
    { kind: 'online', start: today(14, 30, 2), minutes: 60, apps: [id('Bùi Thị Hương')], owner: r.ha!, interviewers: [r.ha!], status: 'confirmed' },
    { kind: 'skill_test', start: today(8, 30, 2), minutes: 180, apps: mass.slice(1, 3).map((m) => m.id), owner: r.minhanh!, interviewers: [long.id], status: 'pending', location: 'Xưởng test Saitama' },
  ];
  const jobOfApp = new Map((await prisma.application.findMany({ where: { id: { in: slots.flatMap((s) => s.apps) } }, select: { id: true, job: { select: { employerId: true } } } })).map((a) => [a.id, a.job.employerId]));
  for (const [k, s] of slots.entries()) {
    const end = new Date(s.start.getTime() + s.minutes * MIN);
    const past = end.getTime() < now;
    await prisma.interview.create({
      data: {
        kind: s.kind,
        status: past ? 'done' : 'scheduled',
        startAt: s.start,
        endAt: end,
        platform: s.kind === 'online' ? 'zoom' : null,
        meetingUrl: s.kind === 'online' ? `https://zoom.us/j/84522${String(1930 + k)}` : null,
        location: s.location ?? null,
        partnerName: s.partner ?? null,
        channels: ['zalo', 'sms'],
        employerId: jobOfApp.get(s.apps[0]!) ?? null,
        ownerId: s.owner,
        interviewers: { connect: s.interviewers.map((rid) => ({ id: rid })) },
        attendees: { create: s.apps.map((applicationId) => ({ applicationId, status: s.status ?? 'pending', respondedAt: s.status === 'pending' ? null : new Date(s.start.getTime() - DAY) })) },
        createdAt: new Date(s.start.getTime() - 3 * DAY),
      },
    });
    if (!past) await prisma.application.updateMany({ where: { id: { in: s.apps } }, data: { interviewAt: s.start } });
  }

  /* ---------- Lượt xem theo ngày + nhật ký tin ---------- */
  // Thời điểm tạo tin trước khi đăng; lượt xem tỉ lệ với số hồ sơ (chuyển đổi ~3 – 4% như thực tế)
  await prisma.$executeRaw`UPDATE "Job" SET "createdAt" = "publishedAt" - interval '2 hours' WHERE "publishedAt" IS NOT NULL AND "createdAt" > "publishedAt"`;
  await prisma.$executeRaw`UPDATE "Job" j SET views = j.views + 25 * (SELECT count(*) FROM "Application" a WHERE a."jobId" = j.id)`;
  const firstApp = new Map(
    (await prisma.application.groupBy({ by: ['jobId'], _min: { createdAt: true } })).map((r) => [r.jobId, r._min.createdAt]),
  );
  const viewJobs = await prisma.job.findMany({ where: { status: { in: ['open', 'closed', 'paused'] } }, select: { id: true, views: true, publishedAt: true } });
  const viewRows = [];
  for (const j of viewJobs) {
    // Tin có hồ sơ từ trước ngày đăng (dữ liệu demo) → tính lượt xem từ hồ sơ đầu tiên
    const from = [j.publishedAt, firstApp.get(j.id)].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
    const days = Math.min(60, Math.max(1, Math.ceil((now - (from?.getTime() ?? now)) / DAY)));
    const base = Math.max(1, j.views / days);
    for (let d = 0; d < days; d++) {
      const day = new Date(now - d * DAY);
      day.setHours(0, 0, 0, 0);
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      viewRows.push({ jobId: j.id, day, count: Math.round(base * (weekend ? 0.7 : 1) * (0.6 + rand() * 0.8)) });
    }
  }
  await prisma.jobViewDay.createMany({ data: viewRows });

  const camcomJobs = await prisma.job.findMany({ where: { employerId: camcomId }, select: { id: true, recruiterId: true, status: true, publishedAt: true, createdAt: true } });
  await prisma.jobEvent.createMany({
    data: camcomJobs.flatMap((j) => [
      { jobId: j.id, actorId: j.recruiterId, action: 'create', createdAt: new Date((j.publishedAt ?? j.createdAt).getTime() - 2 * HOUR) },
      ...(j.publishedAt ? [{ jobId: j.id, actorId: null, action: 'approve', createdAt: j.publishedAt }] : []),
    ]),
  });
  await prisma.jobEvent.createMany({
    data: [
      { jobId: jobIds[6]!, actorId: r.ha!, action: 'boost', createdAt: new Date(now - 10 * MIN) },
      { jobId: jobIds[3]!, actorId: r.huy!, action: 'update', note: 'Cập nhật lương cơ bản', createdAt: new Date(now - 20 * HOUR) },
      { jobId: jobIds[16]!, actorId: r.minhanh!, action: 'update', note: 'Bổ sung yêu cầu tiếng Nhật N3', createdAt: new Date(now - 4 * DAY) },
      { jobId: jobIds[0]!, actorId: long.id, action: 'boost', createdAt: new Date(now - 11 * DAY) },
    ],
  });
  await prisma.job.update({ where: { id: jobIds[6]! }, data: { boostedAt: new Date(now - 10 * MIN) } });

  // Thêm 1 bản nháp và 1 tin hết hạn cho CAMCOM (đủ các tab ở design 12)
  await prisma.job.update({ where: { id: jobIds[18]! }, data: { status: 'closed', deadline: new Date(now - 4 * DAY) } });
  await prisma.jobEvent.create({ data: { jobId: jobIds[18]!, actorId: long.id, action: 'close', note: 'Đủ chỉ tiêu', createdAt: new Date(now - 11 * DAY) } });
  await prisma.job.update({ where: { id: jobIds[22]! }, data: { status: 'draft', publishedAt: null } });
  await prisma.jobEvent.create({ data: { jobId: jobIds[22]!, actorId: r.minhanh!, action: 'draft', createdAt: new Date(now - 4 * DAY) } });

  /* ---------- Việc đã lưu (design 20) + NTD đã xem hồ sơ (design 18) ---------- */
  const saved: Array<[number, number]> = [[27, 5], [15, 7], [13, 21], [5, 1], [19, 14], [14, 3]];
  await prisma.savedJob.createMany({ data: saved.map(([i, daysAgo]) => ({ userId: lan.id, jobId: jobIds[i]!, createdAt: new Date(now - daysAgo * DAY) })) });
  await prisma.job.update({ where: { id: jobIds[27]! }, data: { deadline: new Date(now + 2 * DAY) } });
  await prisma.job.update({ where: { id: jobIds[15]! }, data: { deadline: new Date(now + 3 * DAY) } });

  const viewers = await prisma.recruiter.findMany({ where: { employer: { slug: { in: ['kyodo-koyo-japan', 'mirai-foods-hokkaido'] } } }, select: { id: true } });
  const mp = await prisma.recruiter.findFirstOrThrow({ where: { employerId: minhPhat.id }, select: { id: true } });
  await prisma.profileView.createMany({
    data: [
      { seekerId: lan.id, recruiterId: viewers[0]!.id, createdAt: new Date(now - 2 * HOUR) },
      { seekerId: lan.id, recruiterId: viewers[0]!.id, createdAt: new Date(now - 2 * DAY) },
      { seekerId: lan.id, recruiterId: mp.id, createdAt: new Date(now - 18 * HOUR) },
      { seekerId: lan.id, recruiterId: viewers[1]!.id, createdAt: new Date(now - 4 * DAY) },
      // Tuần trước: ít lượt hơn để thấy mức tăng
      ...Array.from({ length: 8 }, (_, i) => ({ seekerId: lan.id, recruiterId: (i % 2 ? mp : viewers[0]!).id, createdAt: new Date(now - (8 + (i % 6)) * DAY) })),
    ],
  });
}
