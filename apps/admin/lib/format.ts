/** Nối class, bỏ giá trị rỗng */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

const nf = new Intl.NumberFormat('vi-VN');

/** 18420 → "18.420" */
export function formatNumber(n: number): string {
  return nf.format(n);
}

/** 1240000 → "1,24 tr", 86400 → "86,4K" */
export function formatCompact(n: number): string {
  const fmt = (v: number, unit: string) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: v < 10 ? 2 : 1 }).format(v)}${unit}`;
  if (n >= 1_000_000_000) return fmt(n / 1_000_000_000, ' tỷ');
  if (n >= 1_000_000) return fmt(n / 1_000_000, ' tr');
  if (n >= 10_000) return fmt(n / 1000, 'K');
  return formatNumber(n);
}

/** +8,2% / −3% */
export function formatDelta(delta: number, unit: '%' | ' phút' = '%'): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Math.abs(delta))}${unit}`;
}

/** "vừa xong", "4 phút", "2 giờ", "3 ngày" */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ`;
  return `${Math.floor(h / 24)} ngày`;
}

/** 125 → "2 giờ 05"; 24 → "24 phút"; âm → "Quá hạn 5 phút" */
export function formatSla(minutes: number): string {
  if (minutes < 0) return `Quá hạn ${Math.abs(minutes)} phút`;
  if (minutes < 60) return minutes < 20 ? `Còn ${minutes} phút` : `${minutes} phút`;
  return `${Math.floor(minutes / 60)} giờ ${String(minutes % 60).padStart(2, '0')}`;
}

/** 7385 giây → "2 giờ 3 phút" */
export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d} ngày ${h} giờ`;
  if (h) return `${h} giờ ${m} phút`;
  return `${m} phút`;
}

/** "Lê Hoàng Nam" → "HN" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts.at(-2)?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase();
}

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "Thứ Năm, 01/10/2026 · cập nhật 09:42" */
export function formatToday(updatedAt: string | null): string {
  const now = new Date();
  const date = `${WEEKDAY[now.getDay()]}, ${now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  if (!updatedAt) return date;
  const t = new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${date} · cập nhật ${t}`;
}

/** "2026-10-01" → "01/10" */
export function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}
