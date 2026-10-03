import { DEFAULT_NOTIFY_PREFS, groupOf, isQuietTime, resolvePrefs } from './notification-prefs.js';

describe('notification prefs', () => {
  it('dùng mặc định cho nhóm chưa lưu và bỏ giá trị sai kiểu', () => {
    const prefs = resolvePrefs({ interview: { sms: false }, job_match: { app: 'yes' }, bogus: { app: false } });
    expect(prefs.interview).toEqual({ app: true, email: true, sms: false });
    expect(prefs.job_match).toEqual(DEFAULT_NOTIFY_PREFS.job_match);
    expect(Object.keys(prefs)).not.toContain('bogus');
  });

  it('nhận dạng nhóm theo loại thông báo', () => {
    expect(groupOf('interview.scheduled')).toBe('interview');
    expect(groupOf('alert.digest')).toBe('job_match');
    expect(groupOf('application.status')).toBe('application');
    expect(groupOf('lead.new')).toBe('lead');
    expect(groupOf('job.approved')).toBe('system');
  });

  it('giờ yên lặng qua nửa đêm theo giờ Việt Nam', () => {
    // 16:30 UTC = 23:30 VN
    expect(isQuietTime(new Date('2026-10-01T16:30:00Z'), '22:00', '07:00')).toBe(true);
    // 23:59 UTC = 06:59 VN
    expect(isQuietTime(new Date('2026-10-01T23:59:00Z'), '22:00', '07:00')).toBe(true);
    // 00:00 UTC = 07:00 VN
    expect(isQuietTime(new Date('2026-10-02T00:00:00Z'), '22:00', '07:00')).toBe(false);
    // 05:00 UTC = 12:00 VN, khung trong ngày 12:00–13:30
    expect(isQuietTime(new Date('2026-10-02T05:00:00Z'), '12:00', '13:30')).toBe(true);
    expect(isQuietTime(new Date('2026-10-02T05:00:00Z'), '08:00', '08:00')).toBe(false);
  });
});
