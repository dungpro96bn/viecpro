/**
 * Điểm rủi ro 0–100 cho tin chờ duyệt – chấm bằng luật, giải thích được.
 * (Mẫu giao diện ghi "Rủi ro AI": khi có mô hình AI chỉ cần thay hàm này.)
 */

export interface RiskInput {
  /** Số báo cáo vi phạm đang mở của tin / doanh nghiệp */
  openReports: number;
  employerVerified: boolean;
  /** Tuổi tài khoản doanh nghiệp (ngày) */
  employerAgeDays: number;
  salary: number;
  /** Lương trung vị các tin cùng chương trình + ngành (null nếu chưa đủ dữ liệu) */
  medianSalary: number | null;
  /** Có tin khác trùng tiêu đề trong 60 ngày */
  duplicate: boolean;
}

export interface RiskResult {
  score: number;
  /** Lý do nổi bật nhất để hiển thị */
  flag: string | null;
  reasons: string[];
}

const SALARY_DEVIATION = 0.3;

export function scoreJobRisk(input: RiskInput): RiskResult {
  const reasons: Array<{ label: string; weight: number }> = [];

  if (input.openReports > 0) reasons.push({ label: 'Bị báo cáo', weight: 45 + Math.min(15, (input.openReports - 1) * 5) });
  if (input.medianSalary && Math.abs(input.salary / input.medianSalary - 1) > SALARY_DEVIATION) {
    reasons.push({ label: 'Lương bất thường', weight: 30 });
  }
  if (input.duplicate) reasons.push({ label: 'Trùng tin cũ', weight: 25 });
  if (input.employerAgeDays < 30) reasons.push({ label: 'DN mới', weight: 20 });
  if (!input.employerVerified) reasons.push({ label: 'Chưa xác minh', weight: 15 });

  const score = Math.min(100, 5 + reasons.reduce((s, r) => s + r.weight, 0));
  const sorted = [...reasons].sort((a, b) => b.weight - a.weight);
  // "Chưa xác minh" là trạng thái phổ biến, chỉ làm cờ chính khi không có lý do nào khác
  const flag = sorted.find((r) => r.label !== 'Chưa xác minh')?.label ?? sorted[0]?.label ?? null;
  return { score, flag, reasons: sorted.map((r) => r.label) };
}

export function median(values: number[]): number | null {
  if (values.length < 3) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}
