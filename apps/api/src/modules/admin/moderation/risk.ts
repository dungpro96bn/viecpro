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
  /** Kiểm tra tự động nội dung (contentFlags) */
  feeKeyword?: boolean;
  contactInContent?: boolean;
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

  if (input.feeKeyword) reasons.push({ label: 'Thu phí ngoài bảng chi phí', weight: 35 });
  if (input.contactInContent) reasons.push({ label: 'Có SĐT / link trong nội dung', weight: 25 });
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

/** Từ khoá phí ngoài hợp đồng (spec M11: "phí giữ chỗ", "đặt cọc"…) – so khớp không dấu */
const FEE_KEYWORDS = ['phi giu cho', 'dat coc', 'tien coc', 'phi dam bao', 'phi bao dam', 'phi chong tron', 'phi phat sinh', 'phi lot tay', 'phi moi gioi'];
/** Số điện thoại VN (9–11 số, có thể có dấu cách / chấm) hoặc +84 */
const PHONE_RE = /(?<![\d.])(?:\+84|84|0)(?:[\s.-]?\d){8,10}(?![\d])/;
const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|vn|net|org|info|me|link)\b|zalo\.me|fb\.com|facebook\.com/i;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Kiểm tra tự động nội dung tin (A-02): từ khoá phí, SĐT / link bên ngoài */
export function contentFlags(text: string): { feeKeyword: boolean; contactInContent: boolean } {
  const folded = fold(text);
  return {
    feeKeyword: FEE_KEYWORDS.some((k) => folded.includes(k)),
    contactInContent: PHONE_RE.test(text) || LINK_RE.test(text),
  };
}

export interface CheckItem {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  note: string | null;
}

/**
 * Danh sách kiểm tra tự động hiển thị cho kiểm duyệt viên (spec A-02, icon scan-check).
 * Cùng dữ liệu với scoreJobRisk nhưng trình bày từng mục đạt / cần xem / lỗi.
 */
export function autoChecks(input: RiskInput & { feeUsd: number | null }): CheckItem[] {
  const deviation = input.medianSalary ? input.salary / input.medianSalary - 1 : null;
  const pct = deviation === null ? null : Math.round(deviation * 100);
  return [
    { key: 'contact', label: 'Không có SĐT / link bên ngoài trong nội dung', status: input.contactInContent ? 'fail' : 'pass', note: input.contactInContent ? 'Phát hiện số điện thoại hoặc đường link' : null },
    { key: 'fee_keyword', label: 'Không có từ khoá thu phí (đặt cọc, phí giữ chỗ…)', status: input.feeKeyword ? 'fail' : 'pass', note: input.feeKeyword ? 'Nội dung nhắc tới khoản phí ngoài bảng chi phí' : null },
    {
      key: 'fee_disclosed',
      label: 'Công khai chi phí xuất cảnh',
      status: input.feeUsd === null ? 'warn' : 'pass',
      note: input.feeUsd === null ? 'Chưa ghi chi phí (bắt buộc ghi rõ, kể cả 0 USD)' : input.feeUsd === 0 ? 'Miễn phí xuất cảnh' : `${input.feeUsd.toLocaleString('vi-VN')} USD`,
    },
    {
      key: 'salary',
      label: 'Lương so với trung vị cùng ngành',
      status: pct === null ? 'pass' : Math.abs(pct) > SALARY_DEVIATION * 100 ? 'warn' : 'pass',
      note: pct === null ? 'Chưa đủ dữ liệu so sánh' : `${pct > 0 ? '+' : ''}${pct}% so với trung vị ${input.medianSalary!.toLocaleString('vi-VN')} ¥`,
    },
    { key: 'duplicate', label: 'Không trùng tin đã đăng (60 ngày)', status: input.duplicate ? 'warn' : 'pass', note: input.duplicate ? 'Có tin cùng tiêu đề' : null },
    { key: 'reports', label: 'Không có báo cáo vi phạm đang mở', status: input.openReports ? 'fail' : 'pass', note: input.openReports ? `${input.openReports} báo cáo liên quan tin / doanh nghiệp` : null },
    { key: 'verified', label: 'Doanh nghiệp đã xác minh', status: input.employerVerified ? 'pass' : 'warn', note: input.employerVerified ? null : 'Chưa xác minh giấy phép XKLĐ' },
    { key: 'age', label: 'Tài khoản doanh nghiệp trên 30 ngày', status: input.employerAgeDays < 30 ? 'warn' : 'pass', note: input.employerAgeDays < 30 ? `Mới tạo ${Math.max(0, Math.floor(input.employerAgeDays))} ngày` : null },
  ];
}
