/** Bỏ dấu tiếng Việt, chữ thường – dùng cho slug và tìm kiếm không dấu */
export function stripVietnamese(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** "Tuyển 12 nam tại Aichi" → "tuyen-12-nam-tai-aichi" */
export function slugify(s: string): string {
  return stripVietnamese(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Chuẩn hoá chuỗi tìm kiếm: không dấu, gộp khoảng trắng */
export function normalizeSearch(s: string): string {
  return stripVietnamese(s).replace(/\s+/g, ' ').trim();
}

/**
 * Chuẩn hoá số điện thoại Việt Nam về dạng E.164 "+84xxxxxxxxx".
 * Nhận "0912 345 678", "912345678", "+84 912 345 678", "84912345678". Trả null nếu không hợp lệ.
 */
export function normalizeVnPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('84') && d.length === 11) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return /^[35789]\d{8}$/.test(d) ? `+84${d}` : null;
}

/** "+84912345678" → "0912 345 678" */
export function formatVnPhone(e164: string): string {
  const d = e164.replace(/^\+84/, '0');
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

/** "+84912345678" → "0912 xxx 678" */
export function maskVnPhone(e164: string): string {
  const d = e164.replace(/^\+84/, '0');
  return `${d.slice(0, 4)} xxx ${d.slice(7)}`;
}

/** Quy tắc mật khẩu – dùng chung cho form web, mobile và API */
export const PASSWORD_RULES = [
  { key: 'length', label: '8+ ký tự', test: (v: string) => v.length >= 8 },
  { key: 'digit', label: 'Có chữ số', test: (v: string) => /\d/.test(v) },
  { key: 'case', label: 'Chữ hoa & thường', test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
] as const;

/** Tên ngắn của đơn hàng: "Lắp ráp điện tử – Saitama" (công việc cụ thể, thiếu thì dùng ngành) */
export function jobShortTitle(job: { position?: string | null; industry: string; pref: string }): string {
  const what = job.position?.trim() || job.industry;
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} – ${job.pref}`;
}

/** Tuổi tròn theo năm sinh */
export function ageOf(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

/** Thực lĩnh ước tính sau thuế, bảo hiểm, nhà ở (~26%) – làm tròn 1.000 ¥ */
export function estimateNetIncome(salary: number): number {
  return Math.round((salary * 0.74) / 1000) * 1000;
}

/** Thu nhập dự kiến = lương + tăng ca (hệ số 125%, 160 giờ / tháng); làm tròn 5.000 ¥ */
export function estimateIncome(salary: number, overtimeHours = 0): { low: number; high: number } {
  const overtime = (salary / 160) * 1.25 * overtimeHours;
  const round = (n: number) => Math.round(n / 5000) * 5000;
  return { low: round(salary + overtime * 0.8), high: round(salary + overtime * 1.2 + 10000) };
}

/** Yên → triệu VNĐ (1 ¥ ≈ 170 VNĐ) */
export function yenToMillionVnd(yen: number): number {
  return Math.round((yen * 170) / 100_000) / 10;
}

/** "lan.nguyen99@gmail.com" → "la•••99@gmail.com" (không lộ đủ email trong response / UI) */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  const shown = user.length <= 3 ? user.slice(0, 1) : `${user.slice(0, 2)}•••${user.slice(-2)}`;
  return `${shown}${user.length <= 3 ? '•••' : ''}@${domain}`;
}

/** "+84912345678" → "•••• 345 678" (ô chọn kênh nhận mã – design 03) */
export function maskPhoneTail(e164: string): string {
  const d = e164.replace(/^\+84/, '0');
  return `•••• ${d.slice(4, 7)} ${d.slice(7)}`;
}
