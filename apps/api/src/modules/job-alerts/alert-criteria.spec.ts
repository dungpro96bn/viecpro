import { criteriaChips, defaultAlertName, isDue, lastSlot, parseCriteria } from './alert-criteria.js';

describe('job alert criteria', () => {
  it('đọc JSON hỏng thì dùng mặc định', () => {
    expect(parseCriteria({ industries: ['Không có'] }).industries).toEqual([]);
    expect(parseCriteria(null).freeOnly).toBe(false);
  });

  it('đặt tên và chip theo tiêu chí', () => {
    const c = parseCriteria({ industries: ['Điện tử – Lắp ráp'], regions: ['kanto'], programs: ['tts'], freeOnly: true });
    expect(defaultAlertName(c)).toBe('Điện tử · Kanto · Miễn phí');
    expect(criteriaChips(c)).toEqual(['Điện tử', 'Kanto', 'Thực tập sinh', 'Miễn phí']);
    expect(criteriaChips(parseCriteria({}))).toEqual(['Toàn Nhật Bản']);
    expect(defaultAlertName(parseCriteria({ programs: ['tts'], prefs: ['Saitama'] }))).toBe('Thực tập sinh · Saitama');
  });
});

describe('lịch gửi thông báo việc làm', () => {
  // 2026-10-01 là Thứ Năm. 02:00 UTC = 09:00 VN
  const thuMorning = new Date('2026-10-01T02:00:00Z');

  it('mốc hằng ngày là 8:00 VN gần nhất', () => {
    expect(lastSlot('daily', thuMorning).toISOString()).toBe('2026-10-01T01:00:00.000Z');
    // 00:30 UTC = 07:30 VN → mốc hôm trước
    expect(lastSlot('daily', new Date('2026-10-01T00:30:00Z')).toISOString()).toBe('2026-09-30T01:00:00.000Z');
  });

  it('mốc hằng tuần là 8:00 sáng Thứ Hai', () => {
    expect(lastSlot('weekly', thuMorning).toISOString()).toBe('2026-09-28T01:00:00.000Z');
  });

  it('chỉ gửi khi lần trước còn trước mốc', () => {
    const createdAt = new Date('2026-09-01T00:00:00Z');
    expect(isDue({ frequency: 'daily', lastSentAt: new Date('2026-09-30T01:05:00Z'), createdAt }, thuMorning)).toBe(true);
    expect(isDue({ frequency: 'daily', lastSentAt: new Date('2026-10-01T01:05:00Z'), createdAt }, thuMorning)).toBe(false);
    expect(isDue({ frequency: 'weekly', lastSentAt: new Date('2026-09-28T01:10:00Z'), createdAt }, thuMorning)).toBe(false);
    expect(isDue({ frequency: 'instant', lastSentAt: thuMorning, createdAt }, thuMorning)).toBe(true);
  });
});
