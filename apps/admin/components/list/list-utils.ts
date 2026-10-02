import { ApiRequestError } from '@/lib/api';

/** Thông báo lỗi hiển thị cho người dùng */
export const errorText = (error: unknown) => (error instanceof ApiRequestError ? error.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.');

/** Màu nền avatar chữ cái đầu – ổn định theo chuỗi */
const AVATAR_TONES = ['blue', 'orange', 'teal', 'violet', 'green', 'rose'] as const;
export function avatarTone(seed: string): (typeof AVATAR_TONES)[number] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

/** "5 phút trước", "Hôm qua", "3 ngày trước" */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const min = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Hôm qua';
  if (d < 7) return `${d} ngày trước`;
  if (d < 30) return `${Math.floor(d / 7)} tuần trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

/** Ngày giờ đầy đủ giờ Việt Nam */
export const dateTime = (iso: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));

/** Gỡ trùng lặp request: chỉ kết quả của lần gọi mới nhất được dùng */
export function latest() {
  let id = 0;
  return () => {
    const mine = ++id;
    return () => mine === id;
  };
}
