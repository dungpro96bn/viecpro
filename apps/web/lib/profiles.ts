/**
 * Dữ liệu trang hồ sơ nhà tuyển dụng (doanh nghiệp & cá nhân).
 * Đơn hàng trong các hồ sơ là dữ liệu minh họa, không phải tin tuyển dụng thật.
 */
import { JOBS, REGION_OF, toApplyJob } from './data';
import { formatNumber } from './format';
import type { BadgeKind, Job, JobTag, Poster, Program } from './types';

type JobRow = [number, string, Program, string, number, string, string, number, JobTag[], BadgeKind[]];

/** Tạo đơn hàng dựa trên ảnh & đường dẫn của đơn gốc số n */
function makeJob([n, pref, program, title, salary, qty, age, views, tags, badges]: JobRow, posted: string, posterId: string): Job {
  const base = JOBS[n - 1];
  return { ...base, id: `${base.id}-${posterId}`, pref, region: REGION_OF[pref], program, title, salary, qty, age, views, tags, badges, posted, posterId };
}

/* ================================================================== */
/* Công ty TNHH Việt Nam CAMCOM                                        */
/* Nguồn thông tin công khai: vietnam-camcom.com, TopCV                */
/* ================================================================== */
const TEAM: Record<string, { name: string; photo: string }> = {
  ha: { name: 'Nguyễn Thu Hà', photo: '/images/avatars/nguyen-thu-ha.jpg' },
  ma: { name: 'Trần Minh Anh', photo: '/images/avatars/tran-minh-anh.jpg' },
  huy: { name: 'Lê Đức Huy', photo: '/images/avatars/le-duc-huy.jpg' },
  lan: { name: 'Vũ Ngọc Lan', photo: '/images/avatars/vu-ngoc-lan.jpg' },
};

const CAMCOM_ROWS: Array<[JobRow, string, string]> = [
  [[7, 'Saitama', 'tts', 'Tuyển 25 nữ lắp ráp linh kiện điện tử tại Saitama', 176000, '25 nữ', '1996–2006', 4992, ['Đơn miễn phí'], ['new', 'urgent']], 'ha', '2 ngày trước'],
  [[4, 'Osaka', 'tok', 'Kỹ năng đặc định: 10 nữ điều dưỡng viên (Kaigo) tại Osaka', 215000, '10 nữ', '1990–2004', 4466, ['Lương cao'], ['hot']], 'lan', '3 ngày trước'],
  [[1, 'Aichi', 'tts', 'Tuyển 12 nam làm cốp pha, cốt thép xây dựng tại Aichi', 185000, '12 nam', '1990–2005', 1309, ['Xuất cảnh nhanh'], ['new']], 'huy', '5 giờ trước'],
  [[17, 'Tokyo', 'ks', 'Kỹ sư IT: lập trình viên Java, PHP – yêu cầu tiếng Nhật N3', 280000, '05 nam nữ', '1992–2002', 434, ['Bảo lãnh gia đình'], ['hot']], 'ma', '4 ngày trước'],
  [[2, 'Hokkaido', 'tts', 'Tuyển 20 nữ chế biến thực phẩm, đóng hộp cơm bento tại Hokkaido', 178000, '20 nữ', '1992–2006', 6135, ['Tăng ca nhiều'], []], 'ha', '1 ngày trước'],
  [[11, 'Kyoto', 'tok', 'Kỹ năng đặc định: 04 nam đầu bếp món Nhật tại Kyoto', 225000, '04 nam', '1988–2002', 4375, ['Lương cao'], []], 'lan', '1 tuần trước'],
  [[8, 'Kanagawa', 'ks', 'Kỹ sư điện – điện tử bảo trì dây chuyền tại Kanagawa', 260000, '04 nam', '1990–2001', 1085, [], ['urgent']], 'ma', '2 ngày trước'],
  [[9, 'Chiba', 'tts', 'Tuyển 06 nam lái máy xúc, máy công trình tại Chiba', 188000, '06 nam', '1987–2003', 1178, ['Phí thấp'], []], 'huy', '6 ngày trước'],
];

export const CAMCOM = {
  slug: 'viet-nam-camcom',
  name: 'Công ty TNHH Việt Nam CAMCOM',
  shortName: 'Việt Nam CAMCOM',
  phone: '024 7109 4510',
  intro:
    'Công ty TNHH Việt Nam CAMCOM (VIETNAM CAMCOM Co., Ltd.) thành lập ngày 16/09/2019, thuộc tập đoàn CAMCOM GROUP – tập đoàn cung ứng nhân lực hàng đầu tại Nhật Bản với 169 văn phòng trên toàn cầu. Công ty hoạt động trong lĩnh vực tư vấn tuyển dụng và dịch vụ BPO, kết nối nhu cầu nhân lực của doanh nghiệp Nhật Bản với nguồn nhân lực Việt Nam.',
  stats: [
    ['8', 'Đơn đang tuyển (demo)'],
    ['2019', 'Năm thành lập'],
    ['2', 'Văn phòng tại Việt Nam'],
    ['169', 'Văn phòng toàn tập đoàn'],
    ['2.385', 'Nhân sự tập đoàn'],
  ],
  values: [
    { title: 'Tư vấn tuyển dụng', desc: 'Kết nối nhu cầu nhân lực của doanh nghiệp Nhật Bản với ứng viên Việt Nam.', icon: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2.5 21c.6-3.8 3.3-6 6.5-6s5.9 2.2 6.5 6M16 11l2 2 4-4' },
    { title: 'Dịch vụ BPO', desc: 'Thuê ngoài quy trình nghiệp vụ cho doanh nghiệp Nhật.', icon: 'M4 5h16v11H4zM8 20h8M12 16v4' },
    { title: 'Web & Creative', desc: 'Phát triển website và sản phẩm sáng tạo.', icon: 'M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12' },
    { title: 'Hỗ trợ doanh nghiệp vào Việt Nam', desc: 'Tư vấn cho doanh nghiệp Nhật mở rộng hoạt động tại Việt Nam.', icon: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z' },
  ],
  offices: ['Hà Nội – Trụ sở', 'TP. Hồ Chí Minh – Chi nhánh'],
  fields: ['Tư vấn tuyển dụng', 'BPO', 'Web & Creative', 'Hỗ trợ doanh nghiệp Nhật'],
  jobTotals: { all: 8, tts: 4, tok: 2, ks: 2 } as Partial<Record<'all' | Program, number>>,
  team: [
    { name: 'Nguyễn Thu Hà', role: 'Chuyên viên tư vấn', photo: '/images/avatars/nguyen-thu-ha.jpg', rating: '4.9', jobs: 12, online: true },
    { name: 'Trần Minh Anh', role: 'Trưởng phòng tuyển dụng', photo: '/images/avatars/tran-minh-anh.jpg', rating: '4.8', jobs: 9, online: true },
    { name: 'Vũ Ngọc Lan', role: 'Cán bộ tuyển dụng', photo: '/images/avatars/vu-ngoc-lan.jpg', rating: '5.0', jobs: 8, online: false },
    { name: 'Lê Đức Huy', role: 'Cán bộ tuyển dụng', photo: '/images/avatars/le-duc-huy.jpg', rating: '4.6', jobs: 7, online: true },
    { name: 'Đỗ Quang Vinh', role: 'Chuyên viên tư vấn', photo: '/images/avatars/do-quang-vinh.jpg', rating: '4.4', jobs: 4, online: false },
    { name: 'Phạm Xuân Trường', role: 'Cán bộ tuyển dụng', photo: '/images/avatars/pham-xuan-truong.jpg', rating: '4.2', jobs: 2, online: true },
  ],
  contacts: [
    { label: 'Điện thoại', value: '+84 24 7109 4510', icon: 'phone' },
    { label: 'Email', value: 'info_scv@sougo-career-vietnam.com', icon: 'mail' },
    { label: 'Website', value: 'vietnam-camcom.com', icon: 'web' },
    { label: 'Trụ sở chính', value: 'Tầng 11, Văn phòng 2 – Tòa nhà Sun Square, 21 Lê Đức Thọ, Từ Liêm, Hà Nội', icon: 'pin' },
    { label: 'Chi nhánh', value: 'Tầng 9, HBT Tower, 456-458 Hai Bà Trưng, Tân Định, TP. Hồ Chí Minh', icon: 'branch' },
    { label: 'Giờ làm việc', value: '[GIỜ LÀM VIỆC]', icon: 'clock' },
  ] as Array<{ label: string; value: string; icon: ContactIcon }>,
  legal: [
    ['Tên pháp lý', 'Công ty TNHH Việt Nam CAMCOM'],
    ['Tên tiếng Anh', 'VIETNAM CAMCOM Co., Ltd.'],
    ['Mã số thuế', '[MÃ SỐ THUẾ]'],
    ['Người đại diện', 'HISASHI HAYASHIDA'],
    ['Thành lập', '16/09/2019'],
    ['Chứng nhận', 'ISO/IEC 27001:2022'],
  ],
  jobs: CAMCOM_ROWS.map(([row, who, posted]) => {
    const job = makeJob(row, posted, who);
    const member = TEAM[who];
    const poster: Poster = { id: who, name: member.name, role: 'Cán bộ tư vấn · CAMCOM', photo: member.photo, rating: 4.8, city: 'Hà Nội' };
    return {
      job,
      applyJob: toApplyJob(job, 'Công ty TNHH Việt Nam CAMCOM', poster),
      footer: { avatar: member.photo, prefix: 'Phụ trách:', name: member.name, meta: [`${formatNumber(job.views)} lượt xem`, posted] },
    };
  }),
};

/* ================================================================== */
/* Nhà tuyển dụng cá nhân – Nguyễn Thu Hà                              */
/* ================================================================== */
const HA_POSTER: Poster = {
  id: 'ha',
  name: 'Nguyễn Thu Hà',
  role: 'Chuyên viên tư vấn XKLĐ',
  photo: '/images/avatars/nguyen-thu-ha.jpg',
  rating: 4.9,
  city: 'Hà Nội',
  href: '/tu-van-vien/nguyen-thu-ha',
};

const HA_ROWS: Array<[JobRow, string, string, number]> = [
  [[7, 'Saitama', 'tts', 'Tuyển 25 nữ lắp ráp linh kiện điện tử tại Saitama', 176000, '25 nữ', '1996–2006', 2340, ['Đơn miễn phí'], ['new', 'urgent']], 'Minh Phát Global', '2 ngày trước', 2340],
  [[2, 'Hokkaido', 'tts', 'Tuyển 20 nữ chế biến thực phẩm, đóng hộp cơm bento tại Hokkaido', 178000, '20 nữ', '1992–2006', 4120, ['Tăng ca nhiều'], ['hot']], 'Minh Phát Global', '5 giờ trước', 4120],
  [[16, 'Osaka', 'tok', 'Kỹ năng đặc định: 08 nữ phục vụ nhà hàng, khách sạn tại Osaka', 205000, '08 nữ', '1994–2005', 980, [], ['new']], 'Minh Phát Global', '1 ngày trước', 980],
  [[6, 'Tokyo', 'tok', 'Kỹ năng đặc định ngành nhà hàng: 06 nam nữ phục vụ, phụ bếp tại Tokyo', 210000, '06 nam nữ', '1993–2005', 1860, ['Lương cao'], []], 'Minh Phát Global', '3 ngày trước', 1860],
  [[12, 'Chiba', 'tts', 'Tuyển 12 nữ kiểm tra ngoại quan linh kiện tại Chiba', 176000, '12 nữ', '1996–2006', 760, ['Phí thấp'], []], 'Nexa Engineering', '4 ngày trước', 760],
  [[3, 'Ibaraki', 'tts', 'Tuyển 15 nam nữ trồng rau trong nhà kính tại Ibaraki', 172000, '15 nam nữ', '1988–2005', 530, ['Đơn miễn phí'], ['urgent']], 'Minh Phát Global', '1 tuần trước', 530],
];

export const THU_HA = {
  slug: 'nguyen-thu-ha',
  poster: HA_POSTER,
  headline: 'Chuyên viên tư vấn XKLĐ Nhật Bản · Đơn thực tập sinh & kỹ năng đặc định',
  phoneMasked: '0912 xxx 368',
  intro:
    'Mình là Hà, có 8 năm làm tư vấn tuyển dụng đơn Nhật Bản, từng sống và làm việc 3 năm tại Aichi nên hiểu rõ đời sống, công việc của thực tập sinh. Mình chuyên các đơn nhà máy điện tử, chế biến thực phẩm và nhà hàng, ưu tiên đơn phí thấp, ký túc xá gần xưởng. Mình trực tiếp hướng dẫn hồ sơ, luyện phỏng vấn và theo sát các bạn tới khi sang Nhật.',
  stats: [
    ['12', 'Đơn đang đăng'],
    ['480+', 'Lao động đã bay'],
    ['8 năm', 'Kinh nghiệm tư vấn'],
    ['4.9★', 'Điểm đánh giá'],
    ['~15 phút', 'Thời gian phản hồi'],
  ],
  values: [
    { title: 'Từng là thực tập sinh', desc: '3 năm làm việc tại Aichi, chia sẻ kinh nghiệm thực tế.', icon: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z' },
    { title: 'Hỗ trợ trọn quy trình', desc: 'Hồ sơ, khám sức khỏe, luyện phỏng vấn tới ngày bay.', icon: 'M4 12l5 5L20 6' },
    { title: 'Ưu tiên đơn phí thấp', desc: 'Chọn lọc đơn miễn phí, phí thấp, minh bạch chi phí.', icon: 'M12 3l7 3v5.5c0 4.3-3 7.9-7 9.5-4-1.6-7-5.2-7-9.5V6zM9 12l2 2 4-4' },
    { title: 'Luyện phỏng vấn 1–1', desc: 'Tập phỏng vấn tiếng Nhật trực tuyến trước ngày thi tuyển.', icon: 'M4 5h16v11H9l-5 4zM8 10h8M8 13h5' },
  ],
  fields: ['Điện tử – Lắp ráp', 'Chế biến thực phẩm', 'Nhà hàng – Khách sạn', 'Nông nghiệp'],
  prefectures: ['Saitama', 'Chiba', 'Hokkaido', 'Osaka', 'Tokyo', 'Ibaraki'],
  jobTotals: { all: 12, tts: 8, tok: 4 } as Partial<Record<'all' | Program, number>>,
  timeline: [
    { when: '2021 – nay', title: 'Nhà tuyển dụng cá nhân trên viecpro', desc: 'Tư vấn và kết nối hơn 300 lao động với các đơn điện tử, thực phẩm, nhà hàng.' },
    { when: '2018 – 2021', title: 'Cán bộ tuyển dụng – doanh nghiệp phái cử', desc: 'Phụ trách tuyển chọn, đào tạo định hướng cho đơn thực tập sinh khu vực Kanto.' },
    { when: '2014 – 2017', title: 'Thực tập sinh kỹ năng tại Aichi, Nhật Bản', desc: 'Làm việc tại xưởng lắp ráp linh kiện ô tô, hoàn thành hợp đồng 3 năm.' },
  ],
  certificates: [
    { title: 'JLPT N2', desc: 'Năng lực tiếng Nhật' },
    { title: 'Tư vấn XKLĐ', desc: 'Chứng chỉ nghiệp vụ' },
    { title: 'Hoàn thành TTS', desc: 'Chứng nhận 3 năm' },
  ],
  partners: [
    { name: 'Minh Phát Global', note: '9 đơn đang hợp tác · Có giấy phép XKLĐ', logo: '/images/logos/partner-logo.png', href: '/nha-tuyen-dung/viet-nam-camcom' },
    { name: 'Nexa Engineering', note: '3 đơn đang hợp tác · Xí nghiệp tiếp nhận', logo: '/images/logos/logo-7.png', href: '#' },
  ],
  contacts: [
    { label: 'Điện thoại', value: '0912 xxx 368 · bấm để hiện số', icon: 'phone' },
    { label: 'Zalo', value: 'Thu Hà – Tư vấn Nhật Bản', icon: 'chat' },
    { label: 'Email', value: 'thuha@viecpro.vn', icon: 'mail' },
    { label: 'Khu vực nhận hồ sơ', value: 'Hà Nội, Hải Dương, Bắc Ninh, Thái Bình', icon: 'pin' },
    { label: 'Giờ tư vấn', value: 'Thứ 2 – Chủ nhật, 8:00 – 21:00', icon: 'clock' },
  ] as Array<{ label: string; value: string; icon: ContactIcon }>,
  checks: [
    { title: 'Đã xác minh CCCD', note: '03/2021', ok: true },
    { title: 'Đã xác minh số điện thoại', note: '03/2021', ok: true },
    { title: 'Liên kết doanh nghiệp có giấy phép', note: '2 đơn vị', ok: true },
    { title: 'Không có báo cáo vi phạm', note: '12 tháng', ok: true },
    { title: 'Tài khoản Pro', note: 'Chưa đăng ký', ok: false },
  ],
  jobs: HA_ROWS.map(([row, partner, posted, views]) => {
    const job = makeJob(row, posted, 'ha');
    return {
      job,
      applyJob: toApplyJob(job, `${partner} (đối tác phái cử)`, HA_POSTER),
      footer: { avatar: HA_POSTER.photo, prefix: 'Đăng bởi', name: HA_POSTER.name, meta: [`${formatNumber(views)} lượt xem`, posted] },
    };
  }),
};

export type ContactIcon = 'phone' | 'mail' | 'web' | 'pin' | 'branch' | 'clock' | 'chat';

export const CONTACT_ICON_PATH: Record<ContactIcon, string> = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
  mail: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3.5 6l8.5 7 8.5-7',
  web: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  branch: 'M4 21V9l8-5 8 5v12M9 21v-6h6v6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  chat: 'M4 5h16v11H9l-5 4z',
};
