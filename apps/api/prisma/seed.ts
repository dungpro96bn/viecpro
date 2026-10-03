/**
 * Dữ liệu minh hoạ (chuyển từ apps/web/lib/*.ts). Chạy: npm run db:seed
 * Xoá sạch dữ liệu cũ rồi tạo lại – CHỈ dùng cho môi trường dev.
 *
 * Đơn hàng: 30 đơn chi tiết + 6 đơn chờ duyệt (seed-admin) + 120 đơn sinh tự động (seed-jobs).
 * Thêm đơn vào DB đang có (không xoá): npm run db:seed:jobs -- 100
 *
 * Tài khoản demo (mật khẩu: Viecpro123):
 *   - Người tìm việc: 0912345678 (Nguyễn Thị Lan)
 *   - NTD cá nhân: 0987654321 (Nguyễn Thu Hà – đăng tin qua CAMCOM, Minh Phát, Nexa)
 *   - NTD doanh nghiệp: 0988111222 (Trần Minh Anh – quản trị viên Việt Nam CAMCOM)
 *   - Admin (trang quản trị, bật 2FA ở lần đăng nhập đầu):
 *       admin@viecpro.vn (Super Admin) · kiemduyet@viecpro.vn (Kiểm duyệt viên)
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { REGION_OF_PREF, slugify, WEB_LINKS, type BadgeKind, type Industry, type JobTag, type Program } from '@viecpro/shared';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { jobSearchText } from '../src/modules/jobs/job-query.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { seedAdmin } from './seed-admin.js';
import { seedEmployerPortal, seedPartnerCompanies } from './seed-employer.js';
import { detailJson, jobExtras, jobImage, rng, seedBulkJobs } from './seed-jobs.js';

try {
  process.loadEnvFile();
} catch {
  /* dùng biến môi trường hệ thống */
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/* ------------------------------------------------------------------ */
/* Cán bộ tuyển dụng                                                   */
/* ------------------------------------------------------------------ */
const RECRUITERS = [
  { key: 'truong', name: 'Phạm Xuân Trường', title: 'Cán bộ tuyển dụng', photo: 'pham-xuan-truong', rating: 4.2, city: 'TP. Hồ Chí Minh', camcom: true },
  // NTD cá nhân: đăng tin qua doanh nghiệp phái cử (CAMCOM, Minh Phát, Nexa) – camcom = đơn đứng tên CAMCOM
  { key: 'ha', name: 'Nguyễn Thu Hà', title: 'Chuyên viên tư vấn', photo: 'nguyen-thu-ha', rating: 4.9, city: 'Hà Nội', camcom: true },
  { key: 'minhanh', name: 'Trần Minh Anh', title: 'Quản trị viên', photo: 'tran-minh-anh', rating: 4.8, city: 'Hà Nội', camcom: true },
  { key: 'huy', name: 'Lê Đức Huy', title: 'Cán bộ tuyển dụng', photo: 'le-duc-huy', rating: 4.6, city: 'Đà Nẵng', camcom: true },
  { key: 'vinh', name: 'Đỗ Quang Vinh', title: 'Chuyên viên tư vấn', photo: 'do-quang-vinh', rating: 4.4, city: 'Hải Phòng', camcom: true },
  { key: 'lan', name: 'Vũ Ngọc Lan', title: 'Cán bộ tuyển dụng', photo: 'vu-ngoc-lan', rating: 5.0, city: 'Nghệ An', camcom: true },
  { key: 'nam', name: 'Hoàng Văn Nam', title: 'Cán bộ tuyển dụng', photo: null, rating: 3.8, city: 'Thanh Hóa', camcom: false },
] as const;

/* ------------------------------------------------------------------ */
/* Đơn hàng: [ảnh, tỉnh, chương trình, ngành, tiêu đề, lương, SL, giới tính, năm sinh, lượt xem, tags, nhãn, cán bộ, số giờ trước] */
/* ------------------------------------------------------------------ */
type Row = [number, string, Program, Industry, string, number, number, 'nam' | 'nu' | 'both', [number, number], number, JobTag[], BadgeKind[], string, number];

const ROWS: Row[] = [
  [1, 'Aichi', 'tts', 'Xây dựng', 'Tuyển 12 nam làm cốp pha, cốt thép xây dựng tại Aichi', 185000, 12, 'nam', [1990, 2005], 1309, ['Xuất cảnh nhanh'], ['new', 'hot'], 'truong', 3],
  [2, 'Hokkaido', 'tts', 'Chế biến thực phẩm', 'Tuyển 20 nữ chế biến thực phẩm, đóng hộp cơm bento tại Hokkaido', 178000, 20, 'nu', [1992, 2006], 6135, ['Tăng ca nhiều'], ['new'], 'ha', 5],
  [3, 'Ibaraki', 'tts', 'Nông nghiệp', 'Tuyển 15 nam nữ trồng rau trong nhà kính tại Ibaraki', 172000, 15, 'both', [1988, 2005], 728, ['Đơn miễn phí'], ['new', 'urgent'], 'minhanh', 8],
  [4, 'Osaka', 'tok', 'Điều dưỡng – Kaigo', 'Kỹ năng đặc định: 10 nữ điều dưỡng viên (Kaigo) tại Osaka', 215000, 10, 'nu', [1990, 2004], 4466, ['Lương cao'], ['hot'], 'huy', 24],
  [5, 'Hyogo', 'tts', 'Cơ khí', 'Tuyển 08 nam hàn bán tự động, gia công kim loại tại Hyogo', 190000, 8, 'nam', [1989, 2004], 1002, ['Lương cao'], [], 'vinh', 26],
  [6, 'Tokyo', 'tok', 'Nhà hàng – Khách sạn', 'Kỹ năng đặc định ngành nhà hàng: 06 nam nữ phục vụ, phụ bếp tại Tokyo', 210000, 6, 'both', [1993, 2005], 4493, [], [], 'lan', 30],
  [7, 'Saitama', 'tts', 'Điện tử – Lắp ráp', 'Tuyển 25 nữ lắp ráp linh kiện điện tử tại Saitama', 176000, 25, 'nu', [1996, 2006], 4992, ['Đơn miễn phí'], ['urgent'], 'ha', 48],
  [8, 'Tokyo', 'ks', 'Xây dựng', 'Kỹ sư xây dựng, giám sát công trình – tốt nghiệp ĐH, CĐ chuyên ngành', 250000, 5, 'nam', [1990, 2002], 1085, ['Bảo lãnh gia đình'], [], 'minhanh', 50],
  [9, 'Chiba', 'tts', 'Xây dựng', 'Tuyển 06 nam lái máy xúc, máy công trình tại Chiba', 188000, 6, 'nam', [1987, 2003], 1178, ['Phí thấp'], [], 'nam', 52],
  [10, 'Kumamoto', 'tts', 'Nông nghiệp', 'Tuyển 12 nữ thu hoạch cà chua, dâu tây tại Kumamoto', 170000, 12, 'nu', [1990, 2005], 1635, [], [], 'huy', 72],
  [11, 'Kyoto', 'tok', 'Nhà hàng – Khách sạn', 'Kỹ năng đặc định: 04 nam đầu bếp món Nhật tại Kyoto', 225000, 4, 'nam', [1988, 2002], 4375, ['Lương cao'], ['hot'], 'lan', 74],
  [12, 'Kanagawa', 'tts', 'Xây dựng', 'Tuyển 10 nam lắp dựng giàn giáo tại Kanagawa', 195000, 10, 'nam', [1990, 2004], 3169, ['Tăng ca nhiều'], ['urgent'], 'vinh', 76],
  [13, 'Aichi', 'tok', 'Xây dựng', 'Kỹ năng đặc định: 08 nam lắp đặt thiết bị điện công trình tại Aichi', 230000, 8, 'nam', [1988, 2003], 1038, [], [], 'truong', 96],
  [14, 'Shizuoka', 'tts', 'Xây dựng', 'Tuyển 06 nam lợp mái, xây dựng nhà gỗ tại Shizuoka', 182000, 6, 'nam', [1991, 2005], 2560, [], [], 'nam', 98],
  [15, 'Hokkaido', 'tts', 'Nông nghiệp', 'Tuyển 10 nam nữ trồng và thu hoạch cà rốt, khoai tây tại Hokkaido', 171000, 10, 'both', [1989, 2006], 729, ['Đơn miễn phí'], [], 'huy', 120],
  [16, 'Osaka', 'tok', 'Nhà hàng – Khách sạn', 'Kỹ năng đặc định: 08 nữ phục vụ nhà hàng, khách sạn tại Osaka', 205000, 8, 'nu', [1994, 2005], 827, [], [], 'ha', 122],
  [17, 'Tokyo', 'ks', 'Công nghệ thông tin', 'Kỹ sư IT: lập trình viên Java, PHP – yêu cầu tiếng Nhật N3', 280000, 5, 'both', [1992, 2002], 434, ['Bảo lãnh gia đình'], ['hot'], 'minhanh', 144],
  [18, 'Fukuoka', 'tts', 'Xây dựng', 'Tuyển 15 nam công nhân xây dựng tổng hợp tại Fukuoka', 180000, 15, 'nam', [1990, 2005], 99, ['Xuất cảnh nhanh'], [], 'truong', 146],
  [19, 'Hiroshima', 'ks', 'Cơ khí', 'Kỹ sư cơ khí vận hành cần cẩu, thiết bị nâng tại Hiroshima', 245000, 3, 'nam', [1988, 2001], 3757, [], [], 'vinh', 168],
  [20, 'Saitama', 'tok', 'Điều dưỡng – Kaigo', 'Kỹ năng đặc định: 12 nam nữ hộ lý tại viện dưỡng lão Saitama', 208000, 12, 'both', [1990, 2004], 1516, ['Lương cao'], ['urgent'], 'lan', 170],
  [21, 'Gifu', 'tts', 'Cơ khí', 'Tuyển 09 nam vận hành máy CNC, tiện phay tại Gifu', 183000, 9, 'nam', [1991, 2005], 2214, ['Phí thấp', 'Tăng ca nhiều'], ['new'], 'truong', 2],
  [22, 'Miyagi', 'tts', 'Chế biến thực phẩm', 'Tuyển 18 nam nữ chế biến thủy sản tại Miyagi', 174000, 18, 'both', [1990, 2006], 1873, ['Đơn miễn phí', 'Xuất cảnh nhanh'], ['new', 'urgent'], 'ha', 6],
  [23, 'Tokyo', 'ks', 'Công nghệ thông tin', 'Kỹ sư BrSE – cầu nối dự án phần mềm, yêu cầu tiếng Nhật N2', 360000, 3, 'both', [1990, 2001], 3920, ['Lương cao', 'Bảo lãnh gia đình'], ['hot'], 'minhanh', 12],
  [24, 'Nagano', 'tts', 'Nông nghiệp', 'Tuyển 08 nam chăn nuôi bò sữa tại Nagano', 176000, 8, 'nam', [1988, 2004], 964, ['Phí thấp'], [], 'huy', 20],
  [25, 'Kanagawa', 'tok', 'Cơ khí', 'Kỹ năng đặc định: 05 nam bảo dưỡng ô tô tại Kanagawa', 238000, 5, 'nam', [1989, 2003], 2741, ['Lương cao'], [], 'vinh', 36],
  [26, 'Okayama', 'tts', 'Khác', 'Tuyển 15 nữ may mặc, hoàn thiện sản phẩm tại Okayama', 168000, 15, 'nu', [1992, 2006], 1290, ['Đơn miễn phí'], [], 'lan', 60],
  [27, 'Fukuoka', 'tok', 'Nhà hàng – Khách sạn', 'Kỹ năng đặc định: 06 nữ buồng phòng khách sạn tại Fukuoka', 202000, 6, 'nu', [1993, 2005], 1655, ['Xuất cảnh nhanh'], [], 'ha', 84],
  [28, 'Shiga', 'tts', 'Điện tử – Lắp ráp', 'Tuyển 20 nữ kiểm tra bảng mạch điện tử tại Shiga', 175000, 20, 'nu', [1995, 2006], 2380, ['Tăng ca nhiều'], [], 'nam', 110],
  [29, 'Osaka', 'ks', 'Xây dựng', 'Kỹ sư thiết kế CAD xây dựng, làm việc văn phòng tại Osaka', 265000, 4, 'both', [1991, 2002], 1147, ['Bảo lãnh gia đình'], [], 'minhanh', 130],
  [30, 'Gunma', 'tok', 'Điều dưỡng – Kaigo', 'Kỹ năng đặc định: 10 nữ điều dưỡng chăm sóc tại nhà ở Gunma', 212000, 10, 'nu', [1990, 2004], 2032, ['Lương cao', 'Phí thấp'], ['urgent'], 'lan', 150],
];

/** Công việc cụ thể theo số ảnh của đơn → tên ngắn "Lắp ráp điện tử – Saitama" */
const POSITION: Record<number, string> = {
  1: 'Cốp pha xây dựng', 2: 'Chế biến thực phẩm', 3: 'Trồng rau nhà kính', 4: 'Điều dưỡng Kaigo', 5: 'Hàn bán tự động',
  6: 'Phục vụ nhà hàng', 7: 'Lắp ráp điện tử', 8: 'Kỹ sư xây dựng', 9: 'Lái máy xúc', 10: 'Thu hoạch cà chua',
  11: 'Đầu bếp món Nhật', 12: 'Lắp dựng giàn giáo', 13: 'Điện công trình', 14: 'Lợp mái nhà gỗ', 15: 'Thu hoạch cà rốt',
  16: 'Phục vụ khách sạn', 17: 'Kỹ sư IT', 18: 'Xây dựng tổng hợp', 19: 'Vận hành cần cẩu', 20: 'Hộ lý dưỡng lão',
  21: 'Vận hành máy CNC', 22: 'Chế biến thủy sản', 23: 'Kỹ sư BrSE', 24: 'Chăn nuôi bò sữa', 25: 'Bảo dưỡng ô tô',
  26: 'May mặc', 27: 'Buồng phòng khách sạn', 28: 'Kiểm tra bảng mạch', 29: 'Kỹ sư thiết kế CAD', 30: 'Điều dưỡng tại nhà',
};

/** Khối nội dung trang hồ sơ CAMCOM (lib/profiles.ts) */
const CAMCOM_SECTIONS = {
  stats: [['2019', 'Năm thành lập'], ['2', 'Văn phòng tại Việt Nam'], ['169', 'Văn phòng toàn tập đoàn'], ['2.385', 'Nhân sự tập đoàn']],
  values: [
    { title: 'Tư vấn tuyển dụng', desc: 'Kết nối nhu cầu nhân lực của doanh nghiệp Nhật Bản với ứng viên Việt Nam.' },
    { title: 'Dịch vụ BPO', desc: 'Thuê ngoài quy trình nghiệp vụ cho doanh nghiệp Nhật.' },
    { title: 'Web & Creative', desc: 'Phát triển website và sản phẩm sáng tạo.' },
    { title: 'Hỗ trợ doanh nghiệp vào Việt Nam', desc: 'Tư vấn cho doanh nghiệp Nhật mở rộng hoạt động tại Việt Nam.' },
  ],
  offices: ['Hà Nội – Trụ sở', 'TP. Hồ Chí Minh – Chi nhánh'],
  fields: ['Tư vấn tuyển dụng', 'BPO', 'Web & Creative', 'Hỗ trợ doanh nghiệp Nhật'],
  legal: [['Tên tiếng Anh', 'VIETNAM CAMCOM Co., Ltd.'], ['Mã số thuế', '[MÃ SỐ THUẾ]'], ['Người đại diện', 'HISASHI HAYASHIDA'], ['Thành lập', '16/09/2019'], ['Chứng nhận', 'ISO/IEC 27001:2022']],
} satisfies Prisma.InputJsonObject;

/** Khối nội dung trang hồ sơ Nguyễn Thu Hà */
const THU_HA_SECTIONS = {
  stats: [['480+', 'Lao động đã bay'], ['8 năm', 'Kinh nghiệm tư vấn'], ['~15 phút', 'Thời gian phản hồi']],
  values: [
    { title: 'Từng là thực tập sinh', desc: '3 năm làm việc tại Aichi, chia sẻ kinh nghiệm thực tế.' },
    { title: 'Hỗ trợ trọn quy trình', desc: 'Hồ sơ, khám sức khỏe, luyện phỏng vấn tới ngày bay.' },
    { title: 'Ưu tiên đơn phí thấp', desc: 'Chọn lọc đơn miễn phí, phí thấp, minh bạch chi phí.' },
    { title: 'Luyện phỏng vấn 1–1', desc: 'Tập phỏng vấn tiếng Nhật trực tuyến trước ngày thi tuyển.' },
  ],
  fields: ['Điện tử – Lắp ráp', 'Chế biến thực phẩm', 'Nhà hàng – Khách sạn', 'Nông nghiệp'],
  prefectures: ['Saitama', 'Chiba', 'Hokkaido', 'Osaka', 'Tokyo', 'Ibaraki'],
  timeline: [
    { when: '2021 – nay', title: 'Nhà tuyển dụng cá nhân trên viecpro', desc: 'Tư vấn và kết nối hơn 300 lao động.' },
    { when: '2018 – 2021', title: 'Cán bộ tuyển dụng – doanh nghiệp phái cử', desc: 'Phụ trách đơn thực tập sinh khu vực Kanto.' },
    { when: '2014 – 2017', title: 'Thực tập sinh kỹ năng tại Aichi, Nhật Bản', desc: 'Hoàn thành hợp đồng 3 năm.' },
  ],
  certificates: [{ title: 'JLPT N2', desc: 'Năng lực tiếng Nhật' }, { title: 'Tư vấn XKLĐ', desc: 'Chứng chỉ nghiệp vụ' }, { title: 'Hoàn thành TTS', desc: 'Chứng nhận 3 năm' }],
  checks: [
    { title: 'Đã xác minh số điện thoại', note: '03/2021', ok: true },
    { title: 'Không có báo cáo vi phạm', note: '12 tháng', ok: true },
  ],
} satisfies Prisma.InputJsonObject;

async function main() {
  console.log('Xoá dữ liệu cũ…');
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.interviewAttendee.deleteMany(),
    prisma.interview.deleteMany(),
    prisma.applicationNote.deleteMany(),
    prisma.jobEvent.deleteMany(),
    prisma.jobViewDay.deleteMany(),
    prisma.businessPlan.deleteMany(),
    prisma.recruiterPartner.deleteMany(),
    prisma.report.deleteMany(),
    prisma.verificationRequest.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.applicationEvent.deleteMany(),
    prisma.application.deleteMany(),
    prisma.savedJob.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.profileView.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.job.deleteMany(),
    prisma.seekerProfile.deleteMany(),
    prisma.recruiter.deleteMany(),
    prisma.employer.deleteMany(),
    prisma.session.deleteMany(),
    prisma.pushToken.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.user.deleteMany(),
    prisma.adminRole.deleteMany(),
  ]);

  const passwordHash = await hashPassword('Viecpro123');
  const now = Date.now();
  const rand = rng(20260929);

  console.log('Tạo nhà tuyển dụng…');
  const camcom = await prisma.employer.create({
    data: {
      slug: 'viet-nam-camcom',
      name: 'Công ty TNHH Việt Nam CAMCOM',
      shortName: 'Việt Nam CAMCOM',
      logoUrl: '/images/logos/partner-logo.png',
      coverUrl: '/images/banners/employer-cover.jpg',
      intro:
        'Công ty TNHH Việt Nam CAMCOM thành lập ngày 16/09/2019, thuộc tập đoàn CAMCOM GROUP – tập đoàn cung ứng nhân lực hàng đầu tại Nhật Bản với 169 văn phòng trên toàn cầu.',
      phone: '+842471094510',
      email: 'info_scv@sougo-career-vietnam.com',
      website: 'vietnam-camcom.com',
      address: 'Tầng 11, Văn phòng 2 – Tòa nhà Sun Square, 21 Lê Đức Thọ, Từ Liêm, Hà Nội',
      verified: true,
      sections: CAMCOM_SECTIONS,
    },
  });

  // Tài khoản NTD demo gắn với hồ sơ Nguyễn Thu Hà
  const haUser = await prisma.user.create({
    data: { role: 'employer', name: 'Nguyễn Thu Hà', phone: '+84987654321', email: 'thuha@viecpro.vn', passwordHash, phoneVerifiedAt: new Date(), avatarUrl: '/images/avatars/nguyen-thu-ha.jpg' },
  });

  // Quản trị viên doanh nghiệp CAMCOM (design 10)
  const minhAnhUser = await prisma.user.create({
    data: { role: 'employer', name: 'Trần Minh Anh', phone: '+84988111222', email: 'minhanh@camcom.vn', passwordHash, phoneVerifiedAt: new Date(), avatarUrl: '/images/avatars/tran-minh-anh.jpg' },
  });

  const recruiterIds: Record<string, string> = {};
  for (const r of RECRUITERS) {
    const isHa = r.key === 'ha';
    const created = await prisma.recruiter.create({
      data: {
        slug: isHa ? 'nguyen-thu-ha' : slugify(r.name),
        name: r.name,
        title: r.title,
        photoUrl: r.photo ? `/images/avatars/${r.photo}.jpg` : null,
        rating: r.rating,
        city: r.city,
        online: r.key !== 'lan' && r.key !== 'vinh',
        // Thu Hà là NTD cá nhân: không thuộc doanh nghiệp nào, đăng tin qua doanh nghiệp phái cử
        employerId: r.camcom && !isHa ? camcom.id : null,
        // Minh Anh là quản trị viên doanh nghiệp CAMCOM: sửa hồ sơ công ty, quản lý thành viên
        ...(r.key === 'minhanh' && { userId: minhAnhUser.id, companyAdmin: true }),
        ...(isHa && {
          userId: haUser.id,
          reviewCount: 326,
          phone: '+84912000368',
          headline: 'Chuyên viên tư vấn XKLĐ Nhật Bản · Đơn thực tập sinh & kỹ năng đặc định',
          intro: 'Mình là Hà, có 8 năm làm tư vấn tuyển dụng đơn Nhật Bản, từng sống và làm việc 3 năm tại Aichi.',
          sections: THU_HA_SECTIONS,
        }),
      },
    });
    recruiterIds[r.key] = created.id;
  }

  console.log(`Tạo ${ROWS.length} đơn hàng chi tiết…`);
  const jobIds: string[] = [];
  for (const [img, pref, program, industry, title, salary, quantity, gender, [from, to], views, tags, badges, who, hoursAgo] of ROWS) {
    const number = 10230 + img;
    const code = `VP-${number}`;
    const publishedAt = new Date(now - hoursAgo * 3600_000);
    const departureAt = new Date(now + (90 + img * 10) * 86400_000);
    const job = await prisma.job.create({
      data: {
        code,
        slug: `${slugify(title)}-${number}`,
        title,
        searchText: jobSearchText({ title, pref, industry, code }),
        imageUrl: img <= 20 ? `/images/jobs/job-${String(img).padStart(2, '0')}.jpg` : jobImage(industry, (img * 0.618) % 1),
        pref,
        region: REGION_OF_PREF[pref]!,
        program,
        industry,
        salary,
        quantity,
        gender,
        birthYearFrom: from,
        birthYearTo: to,
        tags,
        badges,
        views,
        status: 'open',
        publishedAt,
        departureAt,
        deadline: new Date(now + (5 + img * 3) * 86400_000),
        detail: detailJson({ program, industry, pref, salary, gender, birthYearFrom: from, birthYearTo: to, tags, departureAt }),
        position: POSITION[img] ?? null,
        ...jobExtras(program, tags, rand),
        visibility: badges.includes('urgent') ? 'urgent' : badges.includes('hot') ? 'featured' : 'standard',
        examAt: new Date(now + (14 + img) * 86400_000),
        recruiterId: recruiterIds[who]!,
        employerId: RECRUITERS.find((r) => r.key === who)!.camcom ? camcom.id : null,
      },
    });
    jobIds.push(job.id);
  }

  console.log('Tạo người tìm việc demo…');
  const lan = await prisma.user.create({
    data: {
      role: 'seeker',
      name: 'Nguyễn Thị Lan',
      phone: '+84912345678',
      email: 'lan.nguyen99@gmail.com',
      // Đã xác thực email bằng OTP ở lần ứng tuyển trước → ứng tuyển nhanh không cần nhập lại mã
      emailVerifiedAt: new Date(now - 30 * 86400_000),
      passwordHash,
      phoneVerifiedAt: new Date(),
      seekerProfile: {
        create: {
          birthYear: 1999,
          gender: 'nu',
          hometown: 'Nghệ An',
          programs: ['tts', 'tok'],
          industries: ['Điện tử – Lắp ráp', 'Chế biến thực phẩm'],
          prefs: ['Saitama', 'Hokkaido', 'Chiba', 'Tokyo', 'Ibaraki'],
          consultantId: recruiterIds.ha,
          address: 'Xã Diễn Châu, huyện Diễn Châu, Nghệ An',
          heightCm: 158,
          weightKg: 50,
          eyesight: '10/10, không mù màu',
          maritalStatus: 'single',
          tattoo: false,
          desiredSalary: 175000,
          departWithin: '6',
          maxFeeUsd: 5000,
          jlptLearning: 'N5',
          about: 'Chăm chỉ, khéo tay, đã quen làm theo ca. Mong muốn sang Nhật làm việc ổn định 3 – 5 năm.',
          skills: [
            { name: 'Khéo tay, lắp ráp chi tiết nhỏ', level: 5, note: 'Xác nhận bởi 2 cán bộ tư vấn', verified: true },
            { name: 'Làm việc theo ca', level: 5, note: 'Kinh nghiệm 3 năm', verified: false },
            { name: 'Kiểm tra chất lượng sản phẩm', level: 4, note: 'Kinh nghiệm 3 năm', verified: false },
            { name: 'Sức khoẻ, thể lực', level: 4, note: 'Tự đánh giá', verified: false },
            { name: 'Tin học cơ bản', level: 2, note: 'Tự đánh giá', verified: false },
            { name: 'Nấu ăn', level: 3, note: 'Tự đánh giá', verified: false },
          ],
          experiences: [
            { kind: 'work', title: 'Công nhân may', org: 'Công ty TNHH May Tinh Lợi · KCN Quế Võ, Bắc Ninh', from: '2020-03', to: '2023-06', desc: 'May hoàn thiện áo sơ mi xuất khẩu Nhật, kiểm tra đường may theo tiêu chuẩn khách hàng. Được khen thưởng "Công nhân xuất sắc" 2022.', tags: ['Làm theo ca', 'Kiểm tra chất lượng', 'Tỉ mỉ'] },
            { kind: 'work', title: 'Nhân viên bán hàng', org: 'Siêu thị điện máy Nghệ An', from: '2018-08', to: '2020-02', desc: 'Tư vấn, sắp xếp hàng hoá, kiểm kê kho cuối tháng.', tags: ['Giao tiếp', 'Kiểm kê'] },
            { kind: 'education', title: 'Tốt nghiệp THPT', org: 'Trường THPT Diễn Châu 3, Nghệ An', from: '2014', to: '2017', desc: 'Học lực khá, hạnh kiểm tốt.', tags: [] },
          ],
          documents: [
            { key: 'photo', status: 'uploaded', note: null },
            { key: 'passport', status: 'processing', note: 'hẹn 10/10' },
            { key: 'criminal', status: 'missing', note: null },
            { key: 'health', status: 'missing', note: null },
          ],
        },
      },
    },
  });

  // Hồ sơ ứng tuyển, lịch phỏng vấn, việc đã lưu của Lan tạo trong seed-employer.ts (design 19, 20)
  await prisma.profileView.createMany({ data: Array.from({ length: 9 }, (_, i) => ({ seekerId: lan.id, recruiterId: recruiterIds.ha!, createdAt: new Date(now - i * 18 * 3600_000) })) });
  await prisma.notification.createMany({
    data: [
      { userId: lan.id, type: 'application.interview', title: 'Hẹn phỏng vấn: Tuyển 25 nữ lắp ráp linh kiện điện tử tại Saitama', link: WEB_LINKS.seekerApplications },
      { userId: lan.id, type: 'job.match', title: '12 đơn mới hợp với bạn hôm nay', link: WEB_LINKS.search },
      { userId: lan.id, type: 'saved.expiring', title: '2 việc đã lưu sắp hết hạn', link: WEB_LINKS.seekerSaved },
    ],
  });

  console.log('Tạo dữ liệu quản trị…');
  const stats = await seedAdmin(prisma, { passwordHash, jobIds, camcomId: camcom.id });
  console.log(`  ${stats.applications.toLocaleString('vi-VN')} lượt ứng tuyển, ${stats.sessions.toLocaleString('vi-VN')} phiên đăng nhập (60 ngày)`);

  console.log('Sinh thêm đơn hàng hàng loạt…');
  // Chỉ cán bộ của NTD đã xác minh – tin NTD chưa xác minh phải vào hàng chờ duyệt
  // Đơn hàng loạt thuộc các doanh nghiệp khác, không dồn vào CAMCOM (giữ số tin CAMCOM như design 10, 12)
  await seedPartnerCompanies(prisma);
  const verifiedRecruiters = await prisma.recruiter.findMany({ where: { employer: { verified: true, id: { not: camcom.id } } }, select: { id: true, employerId: true } });
  const moderator = await prisma.user.findUniqueOrThrow({ where: { email: 'kiemduyet@viecpro.vn' }, select: { id: true } });
  const bulk = await seedBulkJobs(prisma, { count: 120, startNumber: 10400, recruiters: verifiedRecruiters, moderatorId: moderator.id });
  console.log(`  ${bulk.length} đơn (${bulk.filter((j) => j.status === 'open').length} đang tuyển)`);

  console.log('Tạo dữ liệu khu nhà tuyển dụng…');
  await seedEmployerPortal(prisma, { jobIds, recruiterIds, camcomId: camcom.id, seekerId: lan.id });

  console.log('✔ Xong. Mật khẩu mọi tài khoản demo: Viecpro123');
  console.log('  Ứng viên 0912345678 · NTD cá nhân 0987654321 · NTD doanh nghiệp 0988111222 · Admin admin@viecpro.vn / kiemduyet@viecpro.vn');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
