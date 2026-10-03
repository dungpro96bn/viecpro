import { NOTIFICATION_GROUPS, type ChannelToggles, type NotificationGroup } from '@viecpro/shared';

/** Mặc định khi người dùng chưa chỉnh (spec 3.11): SMS chỉ bật cho lịch phỏng vấn */
export const DEFAULT_NOTIFY_PREFS: Record<NotificationGroup, ChannelToggles> = {
  interview: { app: true, email: true, sms: true },
  profile_view: { app: true, email: false, sms: false },
  job_match: { app: true, email: true, sms: false },
  application: { app: true, email: true, sms: false },
  lead: { app: true, email: true, sms: false },
  billing: { app: true, email: true, sms: false },
  message: { app: true, email: true, sms: false },
  system: { app: true, email: true, sms: false },
};

/** Gộp tuỳ chọn đã lưu (JSON, có thể thiếu nhóm / sai kiểu) với mặc định */
export function resolvePrefs(stored: unknown): Record<NotificationGroup, ChannelToggles> {
  const raw = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const out = {} as Record<NotificationGroup, ChannelToggles>;
  for (const group of NOTIFICATION_GROUPS) {
    const saved = raw[group] && typeof raw[group] === 'object' ? (raw[group] as Record<string, unknown>) : {};
    const def = DEFAULT_NOTIFY_PREFS[group];
    out[group] = {
      app: typeof saved.app === 'boolean' ? saved.app : def.app,
      email: typeof saved.email === 'boolean' ? saved.email : def.email,
      sms: typeof saved.sms === 'boolean' ? saved.sms : def.sms,
    };
  }
  return out;
}

/** Loại thông báo (notification.type) → nhóm trong Cài đặt */
export function groupOf(type: string): NotificationGroup {
  if (type.startsWith('interview.')) return 'interview';
  if (type.startsWith('profile.')) return 'profile_view';
  if (type.startsWith('alert.')) return 'job_match';
  if (type.startsWith('application.')) return 'application';
  if (type.startsWith('lead.')) return 'lead';
  if (type.startsWith('billing.')) return 'billing';
  if (type.startsWith('message.')) return 'message';
  return 'system';
}

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Phút trong ngày theo giờ Việt Nam (UTC+7, không có giờ mùa hè) */
export function vnMinutes(now: Date): number {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 7 * 60) % (24 * 60);
}

/** Đang trong giờ yên lặng? Khung qua nửa đêm (22:00–07:00) được xử lý đúng */
export function isQuietTime(now: Date, from: string, to: string): boolean {
  const t = vnMinutes(now);
  const a = toMinutes(from);
  const b = toMinutes(to);
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}
