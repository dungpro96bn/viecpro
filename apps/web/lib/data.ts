import type { ApplyJob, Job, Poster, Program, RegionKey } from './types';

/* ------------------------------------------------------------------ */
/* Người đăng tin (cán bộ tuyển dụng) – dữ liệu minh họa               */
/* ------------------------------------------------------------------ */
export const POSTERS: Record<string, Poster> = {
  truong: { id: 'truong', name: 'Phạm Xuân Trường', role: 'Cán bộ tuyển dụng', photo: '/images/avatars/pham-xuan-truong.jpg', rating: 4.2, city: 'TP. Hồ Chí Minh' },
  ha: { id: 'ha', name: 'Nguyễn Thu Hà', role: 'Chuyên viên tư vấn', photo: '/images/avatars/nguyen-thu-ha.jpg', rating: 4.9, city: 'Hà Nội', href: '/tu-van-vien/nguyen-thu-ha' },
  minhanh: { id: 'minhanh', name: 'Trần Minh Anh', role: 'Trưởng phòng tuyển dụng', photo: '/images/avatars/tran-minh-anh.jpg', rating: 4.8, city: 'Hà Nội' },
  huy: { id: 'huy', name: 'Lê Đức Huy', role: 'Cán bộ tuyển dụng', photo: '/images/avatars/le-duc-huy.jpg', rating: 4.6, city: 'Đà Nẵng' },
  vinh: { id: 'vinh', name: 'Đỗ Quang Vinh', role: 'Chuyên viên tư vấn', photo: '/images/avatars/do-quang-vinh.jpg', rating: 4.4, city: 'Hải Phòng' },
  lan: { id: 'lan', name: 'Vũ Ngọc Lan', role: 'Cán bộ tuyển dụng', photo: '/images/avatars/vu-ngoc-lan.jpg', rating: 5.0, city: 'Nghệ An' },
  nam: { id: 'nam', name: 'Hoàng Văn Nam', role: 'Cán bộ tuyển dụng', rating: 3.8, city: 'Thanh Hóa' },
};

export const REGION_OF: Record<string, RegionKey> = {
  Aichi: 'chubu', Shizuoka: 'chubu', Hokkaido: 'hkt', Ibaraki: 'kanto', Tokyo: 'kanto', Saitama: 'kanto',
  Chiba: 'kanto', Kanagawa: 'kanto', Osaka: 'kansai', Hyogo: 'kansai', Kyoto: 'kansai', Hiroshima: 'cs',
  Kumamoto: 'kyu', Fukuoka: 'kyu', Gunma: 'kanto', Tochigi: 'kanto',
};

const img = (n: number) => `/images/jobs/job-${String(n).padStart(2, '0')}.jpg`;

type Row = [number, string, Program, string, number, string, string, number, Job['tags'], Job['badges'], string, string];

/* [ảnh, tỉnh, chương trình, tiêu đề, lương, số lượng, năm sinh, lượt xem, tags, nhãn, người đăng, thời gian] */
const ROWS: Row[] = [
  [1, 'Aichi', 'tts', 'Tuyển 12 nam làm cốp pha, cốt thép xây dựng tại Aichi', 185000, '12 nam', '1990–2005', 1309, ['Xuất cảnh nhanh'], ['new', 'hot'], 'truong', '3 giờ trước'],
  [2, 'Hokkaido', 'tts', 'Tuyển 20 nữ chế biến thực phẩm, đóng hộp cơm bento tại Hokkaido', 178000, '20 nữ', '1992–2006', 6135, ['Tăng ca nhiều'], ['new'], 'ha', '5 giờ trước'],
  [3, 'Ibaraki', 'tts', 'Tuyển 15 nam nữ trồng rau trong nhà kính tại Ibaraki', 172000, '15 nam nữ', '1988–2005', 728, ['Đơn miễn phí'], ['new', 'urgent'], 'minhanh', '8 giờ trước'],
  [4, 'Osaka', 'tok', 'Kỹ năng đặc định: 10 nữ điều dưỡng viên (Kaigo) tại Osaka', 215000, '10 nữ', '1990–2004', 4466, ['Lương cao'], ['hot'], 'huy', '1 ngày trước'],
  [5, 'Hyogo', 'tts', 'Tuyển 08 nam hàn bán tự động, gia công kim loại tại Hyogo', 190000, '08 nam', '1989–2004', 1002, ['Lương cao'], [], 'vinh', '1 ngày trước'],
  [6, 'Tokyo', 'tok', 'Kỹ năng đặc định ngành nhà hàng: 06 nam nữ phục vụ, phụ bếp tại Tokyo', 210000, '06 nam nữ', '1993–2005', 4493, [], [], 'lan', '1 ngày trước'],
  [7, 'Saitama', 'tts', 'Tuyển 25 nữ lắp ráp linh kiện điện tử tại Saitama', 176000, '25 nữ', '1996–2006', 4992, ['Đơn miễn phí'], ['urgent'], 'ha', '2 ngày trước'],
  [8, 'Tokyo', 'ks', 'Kỹ sư xây dựng, giám sát công trình – tốt nghiệp ĐH, CĐ chuyên ngành', 250000, '05 nam', '1990–2002', 1085, ['Bảo lãnh gia đình'], [], 'minhanh', '2 ngày trước'],
  [9, 'Chiba', 'tts', 'Tuyển 06 nam lái máy xúc, máy công trình tại Chiba', 188000, '06 nam', '1987–2003', 1178, ['Phí thấp'], [], 'nam', '2 ngày trước'],
  [10, 'Kumamoto', 'tts', 'Tuyển 12 nữ thu hoạch cà chua, dâu tây tại Kumamoto', 170000, '12 nữ', '1990–2005', 1635, [], [], 'huy', '3 ngày trước'],
  [11, 'Kyoto', 'tok', 'Kỹ năng đặc định: 04 nam đầu bếp món Nhật tại Kyoto', 225000, '04 nam', '1988–2002', 4375, ['Lương cao'], ['hot'], 'lan', '3 ngày trước'],
  [12, 'Kanagawa', 'tts', 'Tuyển 10 nam lắp dựng giàn giáo tại Kanagawa', 195000, '10 nam', '1990–2004', 3169, ['Tăng ca nhiều'], ['urgent'], 'vinh', '3 ngày trước'],
  [13, 'Aichi', 'tok', 'Kỹ năng đặc định: 08 nam lắp đặt thiết bị điện công trình tại Aichi', 230000, '08 nam', '1988–2003', 1038, [], [], 'truong', '4 ngày trước'],
  [14, 'Shizuoka', 'tts', 'Tuyển 06 nam lợp mái, xây dựng nhà gỗ tại Shizuoka', 182000, '06 nam', '1991–2005', 2560, [], [], 'nam', '4 ngày trước'],
  [15, 'Hokkaido', 'tts', 'Tuyển 10 nam nữ trồng và thu hoạch cà rốt, khoai tây tại Hokkaido', 171000, '10 nam nữ', '1989–2006', 729, ['Đơn miễn phí'], [], 'huy', '5 ngày trước'],
  [16, 'Osaka', 'tok', 'Kỹ năng đặc định: 08 nữ phục vụ nhà hàng, khách sạn tại Osaka', 205000, '08 nữ', '1994–2005', 827, [], [], 'ha', '5 ngày trước'],
  [17, 'Tokyo', 'ks', 'Kỹ sư IT: lập trình viên Java, PHP – yêu cầu tiếng Nhật N3', 280000, '05 nam nữ', '1992–2002', 434, ['Bảo lãnh gia đình'], ['hot'], 'minhanh', '6 ngày trước'],
  [18, 'Fukuoka', 'tts', 'Tuyển 15 nam công nhân xây dựng tổng hợp tại Fukuoka', 180000, '15 nam', '1990–2005', 99, ['Xuất cảnh nhanh'], [], 'truong', '6 ngày trước'],
  [19, 'Hiroshima', 'ks', 'Kỹ sư cơ khí vận hành cần cẩu, thiết bị nâng tại Hiroshima', 245000, '03 nam', '1988–2001', 3757, [], [], 'vinh', '1 tuần trước'],
  [20, 'Saitama', 'tok', 'Kỹ năng đặc định: 12 nam nữ hộ lý tại viện dưỡng lão Saitama', 208000, '12 nam nữ', '1990–2004', 1516, ['Lương cao'], ['urgent'], 'lan', '1 tuần trước'],
];

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const JOBS: Job[] = ROWS.map((r) => ({
  id: `vp-${10230 + r[0]}`,
  slug: `${slugify(r[3])}-${10230 + r[0]}`,
  img: img(r[0]),
  pref: r[1],
  region: REGION_OF[r[1]],
  program: r[2],
  title: r[3],
  salary: r[4],
  qty: r[5],
  age: r[6],
  views: r[7],
  tags: r[8],
  badges: r[9],
  posterId: r[10],
  posted: r[11],
}));

export function getJob(slug: string): Job | undefined {
  return JOBS.find((j) => j.slug === slug);
}

export function jobHref(job: Pick<Job, 'slug'>): string {
  return `/viec-lam/${job.slug}`;
}

export function toApplyJob(job: Job, employer?: string, poster?: Poster): ApplyJob {
  const p = poster ?? POSTERS[job.posterId];
  if (!p) throw new Error('Thiếu thông tin cán bộ tuyển dụng của đơn hàng.');
  return {
    slug: job.slug,
    img: job.img,
    title: job.title,
    employer: employer ?? `Xí nghiệp tiếp nhận tại ${job.pref}, Nhật Bản`,
    salary: job.salary,
    qty: job.qty,
    age: job.age,
    program: job.program,
    pref: job.pref,
    poster: { name: p.name, role: p.role, photo: p.photo, rating: p.rating, href: p.href },
  };
}

/* ------------------------------------------------------------------ */
/* Nhãn vùng                                                          */
/* ------------------------------------------------------------------ */
export const REGION_LABEL: Record<RegionKey, string> = {
  hkt: 'Hokkaido – Tohoku',
  kanto: 'Kanto',
  chubu: 'Chubu',
  kansai: 'Kansai',
  cs: 'Chugoku – Shikoku',
  kyu: 'Kyushu – Okinawa',
};

/* ------------------------------------------------------------------ */
/* Banner quảng cáo nhỏ ở sidebar (nội dung minh họa)                  */
/* ------------------------------------------------------------------ */
export const MINI_ADS = [
  { id: 'lang', img: '/images/banners/banner-1.jpg', tag: 'Tiếng Nhật', title: 'Khóa N5 – N4 cấp tốc, học thử miễn phí', cta: 'Đăng ký học thử' },
  { id: 'health', img: '/images/banners/banner-2.jpg', tag: 'Sức khỏe', title: 'Khám sức khỏe XKLĐ, có kết quả trong ngày', cta: 'Đặt lịch khám' },
  { id: 'flight', img: '/images/banners/banner-3.jpg', tag: 'Vé máy bay', title: 'Vé Hà Nội – Tokyo ưu đãi cho lao động', cta: 'Xem giá vé' },
  { id: 'guide', img: '/images/banners/banner-4.jpg', tag: 'Cẩm nang', title: 'Sổ tay sống & làm việc tại Nhật Bản', cta: 'Tải miễn phí' },
] as const;
