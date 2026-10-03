/** Hàm thống kê thuần cho dashboard NTD (không truy cập DB – có unit test) */

const DAY = 86400_000;

/** Đầu ngày theo giờ máy chủ */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Khoá ngày "YYYY-MM-DD" theo giờ địa phương */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Cửa sổ `days` ngày tính tới hôm nay + cửa sổ liền trước cùng độ dài */
export function windows(days: number, now = new Date()) {
  const start = new Date(startOfDay(now).getTime() - (days - 1) * DAY);
  const prevStart = new Date(start.getTime() - days * DAY);
  const keys = Array.from({ length: days }, (_, i) => dayKey(new Date(start.getTime() + i * DAY)));
  return { start, prevStart, keys };
}

/** Đếm số bản ghi theo ngày, đúng thứ tự `keys` */
export function countByDay(dates: Date[], keys: string[]): number[] {
  const index = new Map(keys.map((k, i) => [k, i]));
  const out = keys.map(() => 0);
  for (const d of dates) {
    const i = index.get(dayKey(d));
    if (i !== undefined) out[i]! += 1;
  }
  return out;
}

/** Trung bình theo ngày (ngày không có dữ liệu = giá trị ngày trước, đầu chuỗi = 0) */
export function averageByDay(points: Array<{ at: Date; value: number }>, keys: string[]): number[] {
  const sum = keys.map(() => 0);
  const n = keys.map(() => 0);
  const index = new Map(keys.map((k, i) => [k, i]));
  for (const p of points) {
    const i = index.get(dayKey(p.at));
    if (i === undefined) continue;
    sum[i]! += p.value;
    n[i]! += 1;
  }
  let last = 0;
  return keys.map((_, i) => {
    if (n[i]) last = Math.round(sum[i]! / n[i]!);
    return last;
  });
}

/** Tỉ lệ % làm tròn, mẫu = 0 thì 0 */
export function rate(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0;
}

/** Thứ 7, Chủ nhật */
export function isWeekend(key: string): boolean {
  const day = new Date(`${key}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export interface TrustInput {
  phoneVerified: boolean;
  licensedPartners: number;
  violations12m: number;
  rating: number;
  hasVideo: boolean;
}

/** Điểm tin cậy NTD cá nhân (0–100) và các tiêu chí hiển thị trên hồ sơ công khai */
export function trustScore(input: TrustInput) {
  const checks = [
    { key: 'phone', label: 'SĐT đã xác minh', ok: input.phoneVerified, weight: 20 },
    {
      key: 'partners',
      label: input.licensedPartners ? `${input.licensedPartners} DN phái cử có giấy phép` : 'Chưa liên kết DN phái cử',
      ok: input.licensedPartners > 0,
      weight: 27,
    },
    { key: 'violation', label: 'Không vi phạm 12 tháng', ok: input.violations12m === 0, weight: 27 },
    { key: 'rating', label: `Đánh giá ${input.rating.toFixed(1)}/5`, ok: input.rating >= 4.5, weight: 18 },
    { key: 'video', label: input.hasVideo ? 'Có video giới thiệu' : 'Chưa có video giới thiệu', ok: input.hasVideo, weight: 8 },
  ];
  const score = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  // Tiêu chí điểm đánh giá chỉ dùng để tính điểm, không hiện thành chip
  return { score, checks: checks.filter((c) => c.key !== 'rating').map(({ key, label, ok }) => ({ key, label, ok })) };
}
