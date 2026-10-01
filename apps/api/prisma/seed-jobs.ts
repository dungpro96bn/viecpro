/**
 * Sinh dữ liệu demo cho đơn hàng: nội dung chi tiết theo ngành / chương trình và đơn hàng hàng loạt.
 * CHỈ dùng cho môi trường dev. Số ngẫu nhiên dùng seed cố định để lần chạy nào cũng ra cùng kết quả.
 */
import { JOB_TAGS, PREFECTURES, REGION_OF_PREF, slugify, type BadgeKind, type Industry, type JobDetailContent, type JobGender, type JobTag, type Program } from '@viecpro/shared';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { jobSearchText } from '../src/modules/jobs/job-query.js';

const DAY = 86400_000;

/** Bộ sinh số giả ngẫu nhiên có seed (mulberry32) */
export function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const yen = (n: number) => `${n.toLocaleString('de-DE')} ¥`;
/** 1 ¥ ≈ 170 VNĐ */
const vnd = (n: number) => Math.round((n * 170) / 1_000_000);

/* ------------------------------------------------------------------ */
/* Nội dung theo ngành                                                 */
/* ------------------------------------------------------------------ */
interface IndustryInfo {
  company: string;
  tasks: string[];
  environment: string[];
  experience: string;
  /** Vị trí tuyển: [tên việc, giới tính, chương trình phù hợp] */
  positions: Array<[string, JobGender, Program[]]>;
}

const INDUSTRY: Record<Industry, IndustryInfo> = {
  'Xây dựng': {
    company: 'Công ty xây dựng chuyên thi công nhà ở, nhà xưởng và công trình dân dụng, hơn 40 năm hoạt động',
    tasks: ['Thi công theo bản vẽ và hướng dẫn của đội trưởng', 'Vận chuyển, lắp đặt vật tư tại công trường', 'Dọn dẹp, đảm bảo an toàn khu vực làm việc'],
    environment: ['Làm việc ngoài trời, công trường trong bán kính 30 km', 'Công ty đưa đón bằng xe từ ký túc xá', 'Được cấp đầy đủ đồ bảo hộ lao động'],
    experience: 'Ưu tiên người từng làm xây dựng, không có vẫn được đào tạo',
    positions: [
      ['làm cốp pha, cốt thép', 'nam', ['tts', 'tok']],
      ['lắp dựng giàn giáo', 'nam', ['tts', 'tok']],
      ['lái máy xúc, máy công trình', 'nam', ['tts', 'tok']],
      ['hoàn thiện nội thất, ốp lát', 'nam', ['tts', 'tok']],
      ['sơn công trình', 'both', ['tts']],
      ['giám sát công trình', 'nam', ['ks']],
      ['thiết kế CAD xây dựng', 'both', ['ks']],
    ],
  },
  'Điện tử – Lắp ráp': {
    company: 'Nhà máy sản xuất linh kiện điện tử cho các hãng ô tô và thiết bị gia dụng lớn của Nhật',
    tasks: ['Lắp ráp linh kiện theo quy trình trên dây chuyền', 'Kiểm tra ngoại quan, loại bỏ sản phẩm lỗi', 'Đóng gói, dán nhãn thành phẩm'],
    environment: ['Xưởng sạch, có điều hòa quanh năm', 'Việc nhẹ, chủ yếu đứng hoặc ngồi tại chỗ', 'Có tổ trưởng người Việt hỗ trợ'],
    experience: 'Không yêu cầu kinh nghiệm, cần mắt tốt, không mù màu',
    positions: [
      ['lắp ráp linh kiện điện tử', 'nu', ['tts', 'tok']],
      ['kiểm tra bảng mạch', 'nu', ['tts', 'tok']],
      ['vận hành máy dập linh kiện', 'nam', ['tts']],
      ['đóng gói thiết bị điện', 'both', ['tts']],
      ['điện – điện tử bảo trì dây chuyền', 'nam', ['ks']],
    ],
  },
  'Chế biến thực phẩm': {
    company: 'Xí nghiệp chế biến thực phẩm cung cấp cho chuỗi siêu thị và cửa hàng tiện lợi trên toàn quốc',
    tasks: ['Sơ chế, cắt thái nguyên liệu theo định lượng', 'Vận hành máy đóng gói, xếp sản phẩm lên khay', 'Vệ sinh khu vực sản xuất theo tiêu chuẩn HACCP'],
    environment: ['Làm trong nhà, nhiệt độ ổn định', 'Được cấp đồng phục, ủng, mũ trùm', 'Nhiều tiền bối người Việt đang làm việc'],
    experience: 'Không yêu cầu kinh nghiệm, chăm chỉ, chịu khó',
    positions: [
      ['chế biến, đóng hộp cơm bento', 'nu', ['tts', 'tok']],
      ['chế biến thủy sản', 'both', ['tts', 'tok']],
      ['làm bánh mì công nghiệp', 'nu', ['tts', 'tok']],
      ['chế biến thịt gà', 'both', ['tts']],
      ['đóng gói rau củ', 'nu', ['tts']],
      ['quản lý chất lượng thực phẩm', 'both', ['ks']],
    ],
  },
  'Nông nghiệp': {
    company: 'Nông trại quy mô lớn ứng dụng công nghệ cao, cung cấp nông sản cho hợp tác xã địa phương',
    tasks: ['Gieo trồng, chăm sóc cây theo hướng dẫn', 'Thu hoạch, phân loại và đóng thùng nông sản', 'Vận hành máy nông nghiệp đơn giản'],
    environment: ['Làm trong nhà kính và ngoài đồng', 'Không khí trong lành, chi phí sinh hoạt thấp', 'Chủ trang trại thân thiện, quan tâm thực tập sinh'],
    experience: 'Ưu tiên người từng làm nông nghiệp ở quê',
    positions: [
      ['trồng rau trong nhà kính', 'both', ['tts', 'tok']],
      ['thu hoạch cà chua, dâu tây', 'nu', ['tts', 'tok']],
      ['chăn nuôi bò sữa', 'nam', ['tts', 'tok']],
      ['trồng nấm', 'both', ['tts']],
      ['chăn nuôi gà đẻ trứng', 'both', ['tts']],
    ],
  },
  'Điều dưỡng – Kaigo': {
    company: 'Viện dưỡng lão tư nhân với hơn 120 giường, có nhiều cơ sở trong tỉnh',
    tasks: ['Hỗ trợ người cao tuổi ăn uống, tắm rửa, đi lại', 'Ghi chép tình trạng sức khỏe hằng ngày', 'Tổ chức hoạt động giải trí cho người cao tuổi'],
    environment: ['Làm việc trong nhà, sạch sẽ, có điều hòa', 'Làm theo ca, có phụ cấp ca đêm', 'Được đào tạo kỹ năng chăm sóc bài bản'],
    experience: 'Ưu tiên người học điều dưỡng hoặc từng chăm sóc người già',
    positions: [
      ['điều dưỡng viên (Kaigo)', 'nu', ['tts', 'tok']],
      ['hộ lý tại viện dưỡng lão', 'both', ['tts', 'tok']],
      ['chăm sóc người cao tuổi tại nhà', 'nu', ['tok']],
      ['điều dưỡng có bằng cấp', 'both', ['ks']],
    ],
  },
  'Nhà hàng – Khách sạn': {
    company: 'Chuỗi nhà hàng và khách sạn phục vụ khách du lịch trong và ngoài nước',
    tasks: ['Chuẩn bị nguyên liệu, phụ bếp theo chỉ dẫn đầu bếp', 'Phục vụ bàn, dọn dẹp, sắp xếp phòng ăn', 'Hỗ trợ lễ tân, buồng phòng khi đông khách'],
    environment: ['Môi trường năng động, nhiều khách quốc tế', 'Được ăn ca miễn phí tại nhà hàng', 'Cơ hội giao tiếp, nâng cao tiếng Nhật'],
    experience: 'Không yêu cầu, ưu tiên người ngoại hình ưa nhìn, giao tiếp tốt',
    positions: [
      ['phục vụ, phụ bếp', 'both', ['tok']],
      ['đầu bếp món Nhật', 'nam', ['tok']],
      ['buồng phòng khách sạn', 'nu', ['tok']],
      ['phục vụ nhà hàng, khách sạn', 'nu', ['tok']],
      ['quản lý khách sạn', 'both', ['ks']],
    ],
  },
  'Cơ khí': {
    company: 'Công ty gia công cơ khí chính xác, sản xuất chi tiết máy cho ngành ô tô và đóng tàu',
    tasks: ['Vận hành máy tiện, phay, CNC theo bản vẽ', 'Hàn, cắt, gia công kim loại', 'Đo kiểm kích thước, bảo dưỡng máy định kỳ'],
    environment: ['Xưởng rộng, có hệ thống thông gió', 'Ca ngày cố định, tăng ca đều', 'Được cấp đồ bảo hộ, kính hàn, găng tay'],
    experience: 'Ưu tiên người biết hàn hoặc học trường nghề cơ khí',
    positions: [
      ['hàn bán tự động', 'nam', ['tts', 'tok']],
      ['vận hành máy CNC', 'nam', ['tts', 'tok']],
      ['sơn tĩnh điện', 'nam', ['tts']],
      ['đúc kim loại', 'nam', ['tts']],
      ['bảo dưỡng ô tô', 'nam', ['tok']],
      ['cơ khí thiết kế CAD/CAM', 'nam', ['ks']],
      ['cơ khí vận hành cần cẩu', 'nam', ['ks']],
    ],
  },
  'Công nghệ thông tin': {
    company: 'Công ty phần mềm phát triển hệ thống cho ngân hàng, bán lẻ và doanh nghiệp sản xuất',
    tasks: ['Phát triển, bảo trì hệ thống theo đặc tả', 'Viết tài liệu thiết kế, kiểm thử', 'Phối hợp với đội ngũ người Nhật và offshore Việt Nam'],
    environment: ['Văn phòng hiện đại, làm việc 1–2 ngày từ xa mỗi tuần', 'Giờ làm linh hoạt (flex time)', 'Hỗ trợ học tiếng Nhật và chứng chỉ IT'],
    experience: 'Tối thiểu 1 năm kinh nghiệm lập trình',
    positions: [
      ['lập trình viên Java, PHP', 'both', ['ks']],
      ['kiểm thử phần mềm (QA/QC)', 'both', ['ks']],
      ['lập trình viên Frontend React', 'both', ['ks']],
      ['kỹ sư hạ tầng mạng, cloud', 'both', ['ks']],
      ['BrSE – kỹ sư cầu nối', 'both', ['ks']],
    ],
  },
  Khác: {
    company: 'Doanh nghiệp sản xuất – dịch vụ quy mô vừa, nhiều năm tiếp nhận lao động Việt Nam',
    tasks: ['Thực hiện công việc theo quy trình', 'Kiểm tra sản phẩm, loại bỏ lỗi', 'Ghi chép số liệu, đóng gói thành phẩm'],
    environment: ['Môi trường có điều hòa', 'Ca ngày 8:00 – 17:00, nghỉ trưa 60 phút', 'Có tổ trưởng người Việt hỗ trợ'],
    experience: 'Không yêu cầu, được đào tạo từ đầu',
    positions: [
      ['đóng gói hàng hóa', 'both', ['tts']],
      ['vệ sinh tòa nhà', 'both', ['tts', 'tok']],
      ['may mặc', 'nu', ['tts']],
      ['in ấn bao bì', 'both', ['tts']],
      ['lái xe nâng trong kho', 'nam', ['tok']],
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Nội dung theo chương trình                                          */
/* ------------------------------------------------------------------ */
const PROGRAM: Record<Program, { education: string; japanese: string; contract: string; recruitment: string; trainMonths: number; included: string[]; documents: string[] }> = {
  tts: {
    education: 'Tốt nghiệp THCS trở lên',
    japanese: 'Không yêu cầu, được đào tạo N4 trước xuất cảnh',
    contract: '3 năm, gia hạn thêm 2 năm',
    recruitment: 'Thi tay nghề + phỏng vấn online',
    trainMonths: 5,
    included: ['Phí dịch vụ tuyển dụng', 'Đào tạo tiếng Nhật & định hướng', 'Vé máy bay chiều đi'],
    documents: ['CCCD và xác nhận cư trú', 'Hộ chiếu (nếu đã có)', '4 ảnh 4x6 nền trắng', 'Sơ yếu lý lịch có xác nhận', 'Bằng tốt nghiệp cao nhất'],
  },
  tok: {
    education: 'Tốt nghiệp THPT trở lên',
    japanese: 'JLPT N4 trở lên và chứng chỉ kỹ năng đặc định ngành',
    contract: '1 năm, gia hạn tối đa 5 năm',
    recruitment: 'Phỏng vấn online + xét chứng chỉ',
    trainMonths: 2,
    included: ['Phí dịch vụ tuyển dụng', 'Hỗ trợ thủ tục xin visa', 'Vé máy bay chiều đi', 'Hỗ trợ tìm nhà ở ban đầu'],
    documents: ['CCCD và hộ chiếu', 'Chứng chỉ JLPT N4 trở lên', 'Chứng chỉ kỹ năng đặc định', '4 ảnh 4x6 nền trắng', 'Giấy hoàn thành TTS (nếu có)'],
  },
  ks: {
    education: 'Tốt nghiệp Cao đẳng, Đại học chuyên ngành liên quan',
    japanese: 'JLPT N3 trở lên (N2 là lợi thế)',
    contract: 'Không thời hạn, visa kỹ sư 1 – 5 năm',
    recruitment: 'Phỏng vấn online 2 vòng với doanh nghiệp',
    trainMonths: 1,
    included: ['Phí dịch vụ tuyển dụng', 'Hỗ trợ thủ tục xin visa', 'Vé máy bay chiều đi', 'Hỗ trợ bảo lãnh vợ/chồng, con sang Nhật'],
    documents: ['CCCD và hộ chiếu', 'Bằng tốt nghiệp và bảng điểm', 'Chứng chỉ tiếng Nhật', 'CV tiếng Nhật (rirekisho)', '4 ảnh 3x4 nền trắng'],
  },
};

/**
 * Ảnh minh hoạ trong apps/web/public/images/jobs, xếp theo nội dung ảnh.
 * Ngành ít ảnh dùng thêm ảnh gần nghĩa (vd. Cơ khí dùng ảnh cần cẩu, nhà máy).
 */
const IMAGES: Record<Industry, number[]> = {
  'Xây dựng': [1, 8, 9, 12, 13, 14, 18, 19], // cốt thép, kỹ sư công trường, máy xúc, giàn giáo, công nhân, lợp mái, cần cẩu
  'Điện tử – Lắp ráp': [7, 13], // công nhân nhà máy
  'Chế biến thực phẩm': [2, 11, 10], // món ăn, đầu bếp, cà chua
  'Nông nghiệp': [3, 10, 15], // trồng rau, cà chua, cà rốt
  'Điều dưỡng – Kaigo': [4, 20], // điều dưỡng, y tá
  'Nhà hàng – Khách sạn': [6, 16, 11, 2], // nhà hàng, đầu bếp, món ăn
  'Cơ khí': [5, 19, 7, 13], // xưởng luyện kim, cần cẩu, nhà máy
  'Công nghệ thông tin': [17, 8], // bàn làm việc, văn phòng
  Khác: [7, 13, 5],
};

/** Ảnh ngẫu nhiên hợp với ngành – `r` là số trong [0, 1) */
export const jobImage = (industry: Industry, r: number) => {
  const pool = IMAGES[industry];
  return `/images/jobs/job-${String(pool[Math.floor(r * pool.length)]!).padStart(2, '0')}.jpg`;
};

const GENDER_WORD: Record<JobGender, string> = { nam: 'nam', nu: 'nữ', both: 'nam nữ' };

export interface JobBase {
  program: Program;
  industry: Industry;
  pref: string;
  salary: number;
  gender: JobGender;
  birthYearFrom: number;
  birthYearTo: number;
  tags: readonly string[];
  departureAt: Date;
}

/** Nội dung chi tiết đơn hàng (khớp jobDetailContentSchema), sinh theo ngành / chương trình / lương */
export function buildJobDetail(job: JobBase): JobDetailContent {
  const ind = INDUSTRY[job.industry];
  const prog = PROGRAM[job.program];
  const bonus = job.program === 'ks' ? [30_000, 70_000] : [25_000, 60_000];
  const low = Math.round((job.salary + bonus[0]!) / 5000) * 5000;
  const high = Math.round((job.salary + bonus[1]!) / 5000) * 5000;
  const deduct = Math.round((job.salary * 0.24) / 1000) * 1000;
  const expectedIncome = `${low.toLocaleString('de-DE')} – ${yen(high)}`;
  const free = job.tags.includes('Đơn miễn phí');
  const overtime = job.tags.includes('Tăng ca nhiều') ? '35 – 45 giờ/tháng' : job.program === 'ks' ? '10 – 20 giờ/tháng' : '20 – 30 giờ/tháng';
  const dep = `${String(job.departureAt.getMonth() + 1).padStart(2, '0')}/${job.departureAt.getFullYear()}`;
  const ageFrom = new Date().getFullYear() - job.birthYearTo;
  const ageTo = new Date().getFullYear() - job.birthYearFrom;

  return {
    overview: `${ind.company}, trụ sở tại ${job.pref}. Môi trường làm việc ổn định, chế độ đãi ngộ đúng luật lao động Nhật Bản.`,
    highlights: [
      free ? 'Đơn miễn phí – không thu phí dịch vụ của người lao động' : 'Đăng ký trực tiếp, không qua trung gian',
      `Thu nhập dự kiến ${expectedIncome}/tháng`,
      job.tags.includes('Xuất cảnh nhanh') ? `Xuất cảnh nhanh, dự kiến ${dep}` : `Dự kiến xuất cảnh ${dep}`,
      ...(job.tags.includes('Bảo lãnh gia đình') ? ['Được bảo lãnh vợ/chồng, con sang Nhật'] : []),
    ],
    tasks: ind.tasks,
    environment: ind.environment,
    requirements: [
      ['Giới tính', job.gender === 'both' ? 'Nam hoặc nữ' : GENDER_WORD[job.gender].replace(/^./, (c) => c.toUpperCase())],
      ['Độ tuổi', `${ageFrom} – ${ageTo} tuổi (sinh năm ${job.birthYearFrom} – ${job.birthYearTo})`],
      ['Học vấn', prog.education],
      ['Tiếng Nhật', prog.japanese],
      ['Kinh nghiệm', ind.experience],
      ['Sức khỏe', 'Không mắc bệnh truyền nhiễm, không có hình xăm lớn'],
    ],
    incomes: [
      { label: 'Lương cơ bản', value: yen(job.salary), note: `≈ ${vnd(job.salary)} triệu VNĐ/tháng`, highlight: false },
      { label: 'Thu nhập dự kiến', value: expectedIncome, note: `≈ ${vnd(low)} – ${vnd(high)} triệu VNĐ/tháng`, highlight: true },
      { label: 'Tăng ca', value: overtime, note: 'Hệ số 125%, ngày lễ 135%', highlight: false },
      { label: 'Khấu trừ hàng tháng', value: `≈ ${yen(deduct)}`, note: 'Thuế, bảo hiểm, ký túc xá', highlight: false },
    ],
    hours: [
      ['Thời gian làm', job.industry === 'Điều dưỡng – Kaigo' || job.industry === 'Nhà hàng – Khách sạn' ? '8 giờ/ngày, làm theo ca xoay' : '8 giờ/ngày, 5 ngày/tuần'],
      ['Ngày nghỉ', job.industry === 'Nông nghiệp' ? 'Chủ nhật và 1 ngày trong tuần (~95 ngày/năm)' : 'Thứ 7, Chủ nhật và lễ Nhật (~105 ngày/năm)'],
      ['Hợp đồng', prog.contract],
    ],
    benefits: [
      job.program === 'ks' ? 'Hỗ trợ 50% tiền thuê nhà' : 'Ký túc xá gần nơi làm việc',
      'Bảo hiểm xã hội, y tế theo luật Nhật',
      'Thưởng 2 lần/năm theo kết quả làm việc',
      'Khám sức khỏe định kỳ miễn phí',
    ],
    included: prog.included,
    documents: prog.documents,
    steps: [
      { title: 'Đăng ký & tư vấn', when: 'Ngày 1', desc: 'Để lại thông tin, cán bộ gọi lại trong 30 phút.' },
      { title: 'Khám sức khỏe & sơ tuyển', when: 'Ngày 2 – 5', desc: 'Khám tại bệnh viện được chỉ định.' },
      { title: job.program === 'ks' ? 'Phỏng vấn với doanh nghiệp' : 'Thi tay nghề & phỏng vấn', when: 'Tuần 1 – 2', desc: 'Phỏng vấn online trực tiếp với doanh nghiệp Nhật.' },
      { title: job.program === 'tts' ? 'Đào tạo tiếng Nhật' : 'Hoàn thiện hồ sơ visa', when: `Tháng 1 – ${prog.trainMonths + 1}`, desc: job.program === 'tts' ? 'Học tiếng Nhật N4, văn hóa và tác phong làm việc.' : 'Xin tư cách lưu trú (COE) và visa.' },
      { title: 'Xuất cảnh', when: dep, desc: 'Bay sang Nhật, được đón tại sân bay.' },
    ],
    recruitment: prog.recruitment,
    contract: prog.contract,
    expectedIncome,
  };
}

/** Cột phụ của đơn: chi phí xuất cảnh, hợp đồng, tiếng Nhật tối thiểu (theo chương trình) */
export function jobExtras(program: Program, tags: readonly string[], r: () => number) {
  const free = tags.includes('Đơn miễn phí');
  const fee = { tts: [3800, 6200], tok: [1500, 3800], ks: [0, 1500] }[program];
  return {
    feeUsd: free ? 0 : Math.round((fee[0]! + r() * (fee[1]! - fee[0]!)) / 100) * 100,
    contractYears: program === 'tts' ? 3 : 5,
    jlptRequired: program === 'tts' ? null : program === 'tok' ? 'N4' : 'N3',
  };
}

/** Prisma cần kiểu Json – nội dung chi tiết luôn là JSON thuần */
export const detailJson = (job: JobBase) => buildJobDetail(job) as unknown as Prisma.InputJsonObject;

/* ------------------------------------------------------------------ */
/* Sinh đơn hàng hàng loạt                                             */
/* ------------------------------------------------------------------ */
const SALARY: Record<Program, [number, number]> = { tts: [165_000, 200_000], tok: [195_000, 260_000], ks: [240_000, 420_000] };
const PROGRAM_WEIGHT: Program[] = ['tts', 'tts', 'tts', 'tts', 'tok', 'tok', 'tok', 'ks'];
/** Tỉnh hay có đơn được chọn nhiều hơn */
const POPULAR = ['Aichi', 'Tokyo', 'Osaka', 'Saitama', 'Chiba', 'Kanagawa', 'Hokkaido', 'Fukuoka', 'Hyogo', 'Ibaraki', 'Shizuoka', 'Gifu', 'Hiroshima', 'Kumamoto'];

export interface BulkOptions {
  count: number;
  /** Số mã đầu tiên: VP-<startNumber> */
  startNumber: number;
  /** Người đăng tin – chỉ dùng cán bộ của NTD đã xác minh (NTD chưa xác minh phải qua hàng chờ duyệt) */
  recruiters: Array<{ id: string; employerId: string | null }>;
  moderatorId?: string;
  seed?: number;
}

/** Tạo thêm `count` đơn hàng: ~85% đang tuyển, còn lại đã đóng / nháp / bị từ chối */
export async function seedBulkJobs(prisma: PrismaClient, opts: BulkOptions) {
  const rand = rng(opts.seed ?? 20261002);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const now = Date.now();
  const industries = Object.keys(INDUSTRY) as Industry[];

  const data: Prisma.JobCreateManyInput[] = [];
  for (let i = 0; i < opts.count; i++) {
    const program = pick(PROGRAM_WEIGHT);
    const industry = pick(industries.filter((ind) => INDUSTRY[ind].positions.some(([, , p]) => p.includes(program))));
    const [position, gender] = pick(INDUSTRY[industry].positions.filter(([, , p]) => p.includes(program)));
    const pref = rand() < 0.7 ? pick(POPULAR) : pick(PREFECTURES);
    const quantity = program === 'ks' ? between(1, 6) : between(3, 30);
    const qty = String(quantity).padStart(2, '0');
    const title =
      program === 'tts'
        ? `Tuyển ${qty} ${GENDER_WORD[gender]} ${position} tại ${pref}`
        : program === 'tok'
          ? `Kỹ năng đặc định: ${qty} ${GENDER_WORD[gender]} ${position} tại ${pref}`
          : `Kỹ sư ${position.replace(/^kỹ sư /, '')} tại ${pref}`;
    const [min, max] = SALARY[program];
    const salary = Math.round(between(min, max) / 1000) * 1000;
    const birthYearTo = between(2001, 2007) - (program === 'ks' ? 3 : 0);
    const birthYearFrom = birthYearTo - between(12, 18);
    const tags = JOB_TAGS.filter(() => rand() < 0.14) as JobTag[];
    if (salary > max - (max - min) * 0.25 && !tags.includes('Lương cao')) tags.push('Lương cao');

    const roll = rand();
    const status = roll < 0.85 ? 'open' : roll < 0.93 ? 'closed' : roll < 0.97 ? 'draft' : 'rejected';
    const ageH = status === 'closed' ? between(24 * 40, 24 * 120) : between(1, 24 * 45);
    const createdAt = new Date(now - ageH * 3600_000 - between(10, 120) * 60_000);
    const published = status === 'open' || status === 'closed';
    const publishedAt = published ? new Date(now - ageH * 3600_000) : null;
    const departureAt = new Date((publishedAt ?? createdAt).getTime() + between(75, 300) * DAY);
    const deadline = status === 'closed' ? new Date(now - between(1, 30) * DAY) : new Date(now + between(5, 60) * DAY);
    const views = published ? Math.round((between(30, 400) * Math.min(ageH, 24 * 30)) / 24) : 0;
    const badges: BadgeKind[] = [];
    if (status === 'open') {
      if (ageH < 48) badges.push('new');
      if (views > 4000) badges.push('hot');
      if (rand() < 0.15) badges.push('urgent');
    }

    const number = opts.startNumber + i;
    const code = `VP-${number}`;
    const owner = pick(opts.recruiters);
    const moderated = status !== 'draft';
    data.push({
      code,
      slug: `${slugify(title)}-${number}`,
      title,
      searchText: jobSearchText({ title, pref, industry, code }),
      imageUrl: jobImage(industry, rand()),
      pref,
      region: REGION_OF_PREF[pref]!,
      program,
      industry,
      salary,
      quantity,
      gender,
      birthYearFrom,
      birthYearTo,
      tags,
      badges,
      views,
      status,
      publishedAt,
      departureAt,
      deadline,
      detail: detailJson({ program, industry, pref, salary, gender, birthYearFrom, birthYearTo, tags, departureAt }),
      position,
      ...jobExtras(program, tags, rand),
      visibility: badges.includes('urgent') ? 'urgent' : badges.includes('hot') ? 'featured' : 'standard',
      recruiterId: owner.id,
      employerId: owner.employerId,
      createdAt,
      submittedAt: moderated ? createdAt : null,
      moderatedAt: moderated ? new Date(createdAt.getTime() + between(10, 60) * 60_000) : null,
      moderatedById: moderated ? opts.moderatorId : null,
      rejectReason: status === 'rejected' ? 'Thông tin lương không khớp với hợp đồng, vui lòng bổ sung' : null,
    });
  }

  await prisma.job.createMany({ data });
  return data;
}
