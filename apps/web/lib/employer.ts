/** Hàm hiển thị dùng chung cho khu quản lý nhà tuyển dụng và tài khoản ứng viên */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Chữ cái đầu của tên (tên gọi là từ cuối): "Phan Văn Đức" → "Đ" */
export function initialOf(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? '';
  return last.charAt(0).toUpperCase() || '?';
}

/** Tông màu avatar chữ cái – ổn định theo tên */
export const AVATAR_TONES = ['green', 'orange', 'purple', 'pink', 'cyan', 'blue'] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];
export function avatarTone(seed: string): AvatarTone {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

/** "12 phút trước", "2 giờ trước", "Hôm qua", "28/09" */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < MIN) return 'Vừa xong';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} phút trước`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`;
  if (diff < 2 * DAY) return 'Hôm qua';
  return dayMonth(iso, true);
}

/** "16/9" hoặc "16/09" */
export function dayMonth(iso: string | Date, padded = false): string {
  const d = new Date(iso);
  return padded ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : `${d.getDate()}/${d.getMonth() + 1}`;
}

/** "10:00" */
export function hourMinute(iso: string | Date): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Thứ 3, 29/09/2026" */
export function longDate(d: Date = new Date()): string {
  return `${WEEKDAY[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "T2" … "CN" */
export function weekdayShort(d: Date): string {
  return WEEKDAY_SHORT[d.getDay()]!;
}

export function weekdayLong(d: Date): string {
  return WEEKDAY[d.getDay()]!;
}

/** Lời chào theo giờ */
export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

/** Tên gọi (2 từ cuối): "Trần Minh Anh" → "Minh Anh" */
export function shortName(name: string): string {
  return name.trim().split(/\s+/).slice(-2).join(' ');
}

/** 12400 → "12,4K"; 980 → "980" */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}M`;
  if (n >= 1000) return `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString('vi-VN');
}

/** % thay đổi so với kỳ trước: "+18%", "−4%"; kỳ trước = 0 → null */
export function percentDelta(value: number, previous: number): { text: string; up: boolean } | null {
  if (!previous) return null;
  const pct = Math.round(((value - previous) / previous) * 100);
  return { text: `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%`, up: pct >= 0 };
}

/** Chênh lệch tuyệt đối: "+2", "−5 phút" */
export function absoluteDelta(diff: number, unit = ''): { text: string; up: boolean } {
  return { text: `${diff >= 0 ? '+' : '−'}${Math.abs(diff)}${unit}`, up: diff >= 0 };
}

/** Số thập phân kiểu Việt: 3.9 → "3,9" */
export function decimal(n: number, digits = 1): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** Số ngày còn lại tới hạn (làm tròn lên, tối thiểu 0) */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY));
}

/** Toạ độ đường xu hướng cho SVG rộng w, cao h (điểm cao nhất ở trên) */
export function sparkPoints(series: number[], w = 96, h = 36, pad = 4): string {
  if (!series.length) return '';
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const step = series.length > 1 ? w / (series.length - 1) : 0;
  return series.map((v, i) => `${Math.round(i * step)},${Math.round(h - pad - ((v - min) / span) * (h - pad * 2))}`).join(' ');
}

/** Số điện thoại hiển thị "0912 345 678" từ "+84912345678" */
export function displayPhone(e164: string): string {
  const local = e164.replace(/^\+84/, '0');
  return local.replace(/^(\d{4})(\d{3})(\d+)$/, '$1 $2 $3');
}

/** Link gọi / Zalo từ số E.164 */
export function telHref(e164: string): string {
  return `tel:${e164}`;
}
export function zaloHref(e164: string): string {
  return `https://zalo.me/${e164.replace(/^\+84/, '0')}`;
}

/** Che số điện thoại khi hiển thị: "+84912345678" → "09•• ••• 678" (bấm gọi vẫn dùng số thật) */
export function maskPhone(e164: string): string {
  const local = e164.replace(/^\+84/, '0');
  return `${local.slice(0, 2)}•• ••• ${local.slice(-3)}`;
}
