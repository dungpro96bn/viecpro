/** Dựng nội dung chi tiết đơn hàng (trang /viec-lam/[slug]) từ form đăng tin của NTD – hàm thuần, có unit test */
import { EDUCATION_LABEL, estimateIncome, estimateNetIncome, type JobDetailContent, type JobPosting, type JobTag, type Program } from '@viecpro/shared';

export interface JobFormFacts {
  program: Program;
  industry: string;
  pref: string;
  position?: string | null;
  salary: number;
  gender: 'nam' | 'nu' | 'both';
  birthYearFrom: number;
  birthYearTo: number;
  departureAt?: Date | null;
  examAt?: Date | null;
  feeUsd?: number | null;
  contractYears?: number | null;
  jlptRequired?: string | null;
  posting: JobPosting;
}

const yen = (n: number) => `${n.toLocaleString('de-DE')} ¥`;
/** 1 ¥ ≈ 170 VNĐ */
const millionVnd = (n: number) => Math.round((n * 170) / 1_000_000);
const pad = (n: number) => String(n).padStart(2, '0');
const date = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const monthYear = (d: Date) => `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Công thức thu nhập dùng chung với form đăng tin (packages/shared) */
export const expectedIncome = estimateIncome;
export const netIncome = estimateNetIncome;

/** Nhãn đặc điểm tự suy ra từ form (khi NTD không chọn) */
export function deriveTags(f: Pick<JobFormFacts, 'feeUsd' | 'posting' | 'program' | 'departureAt'>, marketMedian: number | null, salary: number, now = new Date()): JobTag[] {
  const tags: JobTag[] = [];
  if (f.feeUsd === 0) tags.push('Đơn miễn phí');
  else if (f.feeUsd !== null && f.feeUsd !== undefined && f.feeUsd <= 3000) tags.push('Phí thấp');
  if (marketMedian && salary >= marketMedian * 1.1) tags.push('Lương cao');
  if ((f.posting.overtimeHours ?? 0) >= 40) tags.push('Tăng ca nhiều');
  if (f.departureAt && f.departureAt.getTime() - now.getTime() < 120 * 86400_000) tags.push('Xuất cảnh nhanh');
  if (f.program === 'ks') tags.push('Bảo lãnh gia đình');
  return tags;
}

const DOCUMENTS: Record<Program, string[]> = {
  tts: ['Giấy tờ tuỳ thân và xác nhận cư trú', 'Hộ chiếu (nếu đã có)', '4 ảnh 4x6 nền trắng', 'Sơ yếu lý lịch có xác nhận', 'Bằng tốt nghiệp cao nhất'],
  tok: ['Giấy tờ tuỳ thân và hộ chiếu', 'Chứng chỉ JLPT', 'Chứng chỉ kỹ năng đặc định', '4 ảnh 4x6 nền trắng'],
  ks: ['Giấy tờ tuỳ thân và hộ chiếu', 'Bằng tốt nghiệp và bảng điểm', 'Chứng chỉ tiếng Nhật', 'CV tiếng Nhật (rirekisho)'],
};

export function buildJobContent(f: JobFormFacts, now = new Date()): JobDetailContent {
  const p = f.posting;
  const what = f.position?.trim() || f.industry;
  const lines = p.description
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean);
  const year = now.getFullYear();
  const ageText = `${year - f.birthYearTo} – ${year - f.birthYearFrom} tuổi (sinh năm ${f.birthYearFrom} – ${f.birthYearTo})`;
  const income = expectedIncome(f.salary, p.overtimeHours ?? 0);
  const incomeText = `${income.low.toLocaleString('de-DE')} – ${yen(income.high)}`;
  const fee = f.feeUsd ?? null;
  const contract = f.contractYears ? `${f.contractYears} năm` : null;

  const requirements: Array<[string, string]> = [
    ['Giới tính', f.gender === 'both' ? 'Nam hoặc nữ' : f.gender === 'nu' ? 'Nữ' : 'Nam'],
    ['Độ tuổi', ageText],
    ['Học vấn', p.educationMin ? `${EDUCATION_LABEL[p.educationMin]} trở lên` : 'Không yêu cầu'],
    ['Tiếng Nhật', f.jlptRequired ? `${f.jlptRequired} trở lên` : 'Không yêu cầu, được đào tạo trước xuất cảnh'],
  ];
  if (p.otherRequirements.length) requirements.push(['Yêu cầu khác', p.otherRequirements.join(', ')]);

  return {
    overview: lines.length ? `${what} tại ${f.pref}. ${lines[0]}` : `${what} tại ${f.pref}, Nhật Bản.`,
    highlights: [
      fee === 0 ? 'Đơn miễn phí – không thu phí dịch vụ của người lao động' : 'Đăng ký trực tiếp, không qua trung gian',
      `Thu nhập dự kiến ${incomeText}/tháng`,
      ...(f.departureAt ? [`Dự kiến xuất cảnh ${monthYear(f.departureAt)}`] : []),
    ],
    tasks: lines.length ? lines : [`${what} theo hướng dẫn của tổ trưởng`],
    environment: [],
    requirements,
    incomes: [
      { label: 'Lương cơ bản', value: yen(f.salary), note: `≈ ${millionVnd(f.salary)} triệu VNĐ/tháng`, highlight: false },
      { label: 'Thu nhập dự kiến', value: incomeText, note: `≈ ${millionVnd(income.low)} – ${millionVnd(income.high)} triệu VNĐ/tháng`, highlight: true },
      ...(p.overtimeHours ? [{ label: 'Làm thêm', value: `~${p.overtimeHours} giờ/tháng`, note: 'Hệ số 125%, ngày lễ 135%', highlight: false }] : []),
      { label: 'Thực lĩnh ước tính', value: `≈ ${yen(netIncome(f.salary))}`, note: 'Sau thuế, bảo hiểm, nhà ở', highlight: false },
    ],
    hours: [['Thời gian làm', '8 giờ/ngày, 5 ngày/tuần'], ...(contract ? ([['Hợp đồng', contract]] as Array<[string, string]>) : [])],
    benefits: p.benefits.length ? [...p.benefits] : ['Bảo hiểm xã hội, y tế theo luật Nhật'],
    included: fee === 0 ? ['Miễn phí dịch vụ tuyển dụng', 'Đào tạo tiếng Nhật & định hướng'] : [`Chi phí xuất cảnh ${fee !== null ? `${fee.toLocaleString('de-DE')} USD` : 'theo thoả thuận'}`, 'Đào tạo tiếng Nhật & định hướng'],
    documents: DOCUMENTS[f.program],
    steps: [
      { title: 'Đăng ký & tư vấn', when: 'Ngày 1', desc: 'Để lại thông tin, cán bộ gọi lại trong 30 phút.' },
      { title: 'Khám sức khỏe & sơ tuyển', when: 'Ngày 2 – 5', desc: 'Khám tại bệnh viện được chỉ định.' },
      { title: 'Thi tuyển', when: f.examAt ? date(f.examAt) : 'Tuần 1 – 2', desc: 'Thi tay nghề và phỏng vấn với doanh nghiệp Nhật.' },
      ...(f.departureAt ? [{ title: 'Xuất cảnh', when: monthYear(f.departureAt), desc: 'Bay sang Nhật, được đón tại sân bay.' }] : []),
    ],
    recruitment: f.examAt ? `Thi tuyển ngày ${date(f.examAt)}` : 'Phỏng vấn online',
    ...(contract && { contract }),
    expectedIncome: incomeText,
    posting: p,
  };
}
