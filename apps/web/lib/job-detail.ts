/**
 * Nội dung chi tiết đơn hàng (dữ liệu minh họa).
 * Khi nối API thật, thay các hằng số dưới đây bằng dữ liệu của từng đơn.
 */
import { JOBS, POSTERS } from './data';
import type { BadgeKind, Program } from './types';

export const DETAIL_ICONS = {
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2.5 21c.6-3.8 3.3-6 6.5-6s5.9 2.2 6.5 6M16 3.5a4 4 0 010 7.5M18.5 15c1.8.8 2.8 2.8 3 6',
  cal: 'M5 5h14a1.5 1.5 0 011.5 1.5V19A1.5 1.5 0 0119 20.5H5A1.5 1.5 0 013.5 19V6.5A1.5 1.5 0 015 5zM3.5 10h17M8 3v4M16 3v4',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  clip: 'M9 4h6v3H9zM7 5.5H5.5v15h13v-15H17M8.5 12l2.5 2.5 4.5-4.5',
  plane: 'M21 15.5l-8-5V4.5a1.5 1.5 0 00-3 0v6l-8 5v2l8-2.5V20l-2 1.5v1l3.5-1 3.5 1v-1L13 20v-5l8 2.5z',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
};

export const DETAIL = {
  code: 'VP-10248',
  industry: 'Lắp ráp linh kiện điện tử',
  recruitment: 'Thi tay nghề + phỏng vấn online',
  departure: 'Tháng 03/2027',
  contract: '3 năm, gia hạn thêm 2 năm',
  deadline: '30/11/2026',
  expectedIncome: { short: '210 – 250K ¥', full: '210.000 – 250.000 ¥', vnd: '≈ 35 – 42 triệu VNĐ (tham khảo)' },
  salaryVnd: '≈ 29 triệu VNĐ (tham khảo)',
  quota: 'Còn 18/25 chỉ tiêu',
  overview:
    'Nexa Engineering là xí nghiệp chuyên sản xuất linh kiện điện tử cho ngành ô tô và thiết bị gia dụng tại Kawaguchi, Saitama. Xí nghiệp cần tuyển 25 lao động nữ lắp ráp, kiểm tra sản phẩm trong phòng sạch. Làm ca ngày cố định, việc nhẹ, tăng ca đều, ký túc xá gần xưởng.',
  highlights: [
    'Đơn miễn phí – đăng ký trực tiếp, không qua trung gian',
    'Làm trong phòng sạch, việc nhẹ nhàng',
    'Thu nhập dự kiến 210.000 – 250.000 ¥/tháng',
    'Ca ngày cố định, ký túc xá gần xưởng',
  ],
  tasks: [
    'Lắp ráp linh kiện điện tử cho ô tô theo quy trình',
    'Kiểm tra sản phẩm bằng kính hiển vi, loại bỏ lỗi',
    'Cắm linh kiện lên bảng mạch (PCB)',
    'Ghi chép số liệu kiểm tra, đóng gói thành phẩm',
  ],
  environment: [
    'Làm trong phòng sạch có điều hòa, không bụi',
    'Mặc đồng phục chống tĩnh điện suốt ca',
    'Ca ngày 8:00 – 17:00, nghỉ trưa 60 phút',
    'Có tổ trưởng người Việt hỗ trợ',
  ],
  requirements: [
    ['Giới tính', 'Nữ'],
    ['Năm sinh', '1996 – 2006 (20 – 30 tuổi)'],
    ['Thị lực', 'Tốt, không mù màu'],
    ['Sức khỏe', 'Không mắc bệnh truyền nhiễm, không có hình xăm lớn'],
    ['Học vấn', 'Tốt nghiệp THPT trở lên'],
    ['Kinh nghiệm', 'Không yêu cầu, được đào tạo từ đầu'],
    ['Khác', 'Khéo tay, cẩn thận, chịu khó'],
  ] as Array<[string, string]>,
  incomes: [
    { label: 'Lương cơ bản', value: '176.000 ¥/tháng', note: '≈ 29 triệu VNĐ', highlight: false },
    { label: 'Thu nhập dự kiến', value: '210.000 – 250.000 ¥', note: '≈ 35 – 42 triệu VNĐ/tháng', highlight: true },
    { label: 'Tăng ca', value: '20 – 30 giờ/tháng', note: 'Hệ số 125%, ngày lễ 135%', highlight: false },
    { label: 'Khấu trừ hàng tháng', value: '≈ 45.000 ¥', note: 'Thuế, bảo hiểm, ký túc xá', highlight: false },
  ],
  hours: [
    ['Thời gian làm', '8 giờ/ngày, 5 ngày/tuần'],
    ['Ca làm', 'Ca ngày cố định 8:00 – 17:00'],
    ['Ngày nghỉ', 'Thứ 7, Chủ nhật và lễ Nhật (~105 ngày/năm)'],
    ['Hợp đồng', '3 năm, có thể gia hạn thêm 2 năm'],
  ] as Array<[string, string]>,
  benefits: [
    'Ký túc xá gần xưởng (≈ 25.000 ¥/tháng)',
    'Bảo hiểm xã hội, y tế theo luật Nhật',
    'Hỗ trợ vé máy bay chiều đi',
    'Thưởng chuyên cần hàng tháng',
    'Khám sức khỏe định kỳ miễn phí',
    'Tổ trưởng người Việt hỗ trợ',
  ],
  included: ['Phí dịch vụ tuyển dụng', 'Đào tạo tiếng Nhật & định hướng', 'Vé máy bay chiều đi', 'Ký túc xá tháng đầu'],
  documents: ['CCCD và xác nhận cư trú', 'Hộ chiếu (nếu đã có)', '4 ảnh 4x6 nền trắng', 'Sơ yếu lý lịch có xác nhận', 'Bằng tốt nghiệp THPT (bản sao)', 'Giấy khám sức khỏe'],
  steps: [
    { title: 'Đăng ký & tư vấn', when: 'Ngày 1', desc: 'Để lại thông tin, cán bộ gọi lại trong 30 phút để tư vấn chi tiết đơn hàng.' },
    { title: 'Khám sức khỏe & sơ tuyển', when: 'Ngày 2 – 5', desc: 'Khám tại bệnh viện được chỉ định, kiểm tra thị lực và độ khéo tay.' },
    { title: 'Thi tay nghề & phỏng vấn', when: 'Tuần 1 – 2', desc: 'Phỏng vấn online trực tiếp với xí nghiệp Nhật, có kết quả sau 1 – 3 ngày.' },
    { title: 'Đào tạo tiếng Nhật', when: 'Tháng 1 – 5', desc: 'Học tiếng Nhật N4, văn hóa và tác phong làm việc tại trung tâm.' },
    { title: 'Hoàn thiện hồ sơ & visa', when: 'Tháng 4 – 6', desc: 'Xin tư cách lưu trú (COE) và visa thực tập sinh.' },
    { title: 'Xuất cảnh', when: '03/2027', desc: 'Bay sang Nhật, được đại diện nghiệp đoàn đón tại sân bay Narita.' },
  ],
};

/** Card đơn hàng trong slider */
export interface SliderJob {
  href: string;
  img: string;
  pref: string;
  program: Program;
  title: string;
  salary: number;
  qty: string;
  age: string;
  poster: { name: string; photo?: string; rating: number };
  posted: string;
  badge: BadgeKind;
}

/** "Đơn hàng tương tự" – tối đa 8 đơn */
export function similarJobs(currentSlug: string): SliderJob[] {
  const picks: Array<[number, BadgeKind]> = [
    [20, 'hot'], [1, 'new'], [2, 'new'], [4, 'urgent'], [6, 'new'], [3, 'urgent'], [11, 'hot'], [17, 'hot'], [5, 'new'], [12, 'urgent'],
  ];
  return picks
    .map(([n, badge]) => ({ j: JOBS[n - 1], badge }))
    .filter(({ j }) => j.slug !== currentSlug)
    .slice(0, 8)
    .map(({ j, badge }) => {
      const p = POSTERS[j.posterId];
      return {
        href: `/viec-lam/${j.slug}`,
        img: j.img,
        pref: j.pref,
        program: j.program,
        title: j.title,
        salary: j.salary,
        qty: j.qty,
        age: j.age,
        poster: { name: p.name, photo: p.photo, rating: p.rating },
        posted: j.posted,
        badge,
      };
    });
}

/** "Đơn hàng cùng nhà tuyển dụng" (Nexa Engineering) – tối đa 8 đơn, dữ liệu minh họa */
export function sameEmployerJobs(): SliderJob[] {
  const HA = { name: 'Nguyễn Thu Hà', photo: '/images/avatars/nguyen-thu-ha.jpg', rating: 4.9 };
  const MA = { name: 'Trần Minh Anh', photo: '/images/avatars/tran-minh-anh.jpg', rating: 4.8 };
  const rows: Array<[number, string, Program, string, number, string, string, typeof HA, string, BadgeKind]> = [
    [17, 'Tokyo', 'ks', 'Kỹ sư IT: lập trình viên Java, PHP – yêu cầu tiếng Nhật N3', 280000, '05 nam nữ', '1992 – 2002', MA, '6 ngày trước', 'hot'],
    [7, 'Saitama', 'tts', 'Tuyển 15 nam lắp ráp bảng mạch điện tử tại Saitama', 178000, '15 nam', '1995 – 2005', HA, '1 ngày trước', 'new'],
    [8, 'Kanagawa', 'ks', 'Kỹ sư điện – điện tử bảo trì dây chuyền tại Kanagawa', 260000, '04 nam', '1990 – 2001', MA, '2 ngày trước', 'urgent'],
    [13, 'Aichi', 'tok', 'Kỹ năng đặc định: 08 nam lắp đặt thiết bị điện tại Aichi', 230000, '08 nam', '1988 – 2003', HA, '3 ngày trước', 'hot'],
    [5, 'Gunma', 'tts', 'Tuyển 10 nam gia công kim loại, hàn linh kiện tại Gunma', 182000, '10 nam', '1990 – 2004', MA, '4 ngày trước', 'new'],
    [19, 'Ibaraki', 'ks', 'Kỹ sư cơ khí vận hành máy CNC, thiết bị tự động tại Ibaraki', 245000, '03 nam', '1988 – 2001', HA, '5 ngày trước', 'urgent'],
    [12, 'Chiba', 'tts', 'Tuyển 12 nữ kiểm tra ngoại quan linh kiện tại Chiba', 176000, '12 nữ', '1996 – 2006', MA, '1 tuần trước', 'hot'],
    [18, 'Tochigi', 'tok', 'Kỹ năng đặc định: 06 nam nữ đóng gói linh kiện tại Tochigi', 205000, '06 nam nữ', '1992 – 2004', HA, '1 tuần trước', 'new'],
  ];
  return rows.map(([n, pref, program, title, salary, qty, age, poster, posted, badge]) => ({
    href: `/viec-lam/${JOBS[n - 1].slug}`,
    img: JOBS[n - 1].img,
    pref,
    program,
    title,
    salary,
    qty,
    age,
    poster,
    posted,
    badge,
  }));
}
