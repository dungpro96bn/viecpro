import type { DashboardRange } from '@viecpro/shared';

/** Số liệu admin tính theo giờ Việt Nam */
export const TZ = 'Asia/Ho_Chi_Minh';
const DAY = 86400_000;
const RANGE_DAYS: Record<DashboardRange, number> = { today: 1, '7d': 7, '30d': 30, quarter: 90 };

/** "2026-10-01" theo giờ VN */
export function vnDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** 00:00 giờ VN của ngày chứa d */
export function vnStartOfDay(d: Date): Date {
  return new Date(`${vnDate(d)}T00:00:00+07:00`);
}

export interface Period {
  days: number;
  from: Date;
  to: Date;
  prevFrom: Date;
  /** Danh sách ngày (YYYY-MM-DD) trong kỳ, tối thiểu 7 ngày để biểu đồ có ý nghĩa */
  chartDays: string[];
  chartFrom: Date;
}

export function periodOf(range: DashboardRange, now = new Date()): Period {
  const days = RANGE_DAYS[range];
  const today = vnStartOfDay(now);
  const from = new Date(today.getTime() - (days - 1) * DAY);
  const chartLen = Math.max(days, 7);
  const chartFrom = new Date(today.getTime() - (chartLen - 1) * DAY);
  const chartDays = Array.from({ length: chartLen }, (_, i) => vnDate(new Date(chartFrom.getTime() + i * DAY + 12 * 3600_000)));
  return { days, from, to: now, prevFrom: new Date(from.getTime() - days * DAY), chartDays, chartFrom };
}

/** % thay đổi, 1 chữ số thập phân; null khi kỳ trước = 0 */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Ghép kết quả GROUP BY ngày vào đủ danh sách ngày (ngày thiếu = 0) */
export function fillDays(days: string[], rows: Array<{ d: string; c: number }>): number[] {
  const map = new Map(rows.map((r) => [r.d, Number(r.c)]));
  return days.map((d) => map.get(d) ?? 0);
}
