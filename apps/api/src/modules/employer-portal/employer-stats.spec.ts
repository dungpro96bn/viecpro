import { averageByDay, countByDay, dayKey, isWeekend, rate, trustScore, windows } from './employer-stats.js';

describe('employer-stats', () => {
  const now = new Date('2026-10-01T15:00:00');

  it('windows: N ngày tới hôm nay + kỳ trước cùng độ dài', () => {
    const w = windows(7, now);
    expect(w.keys).toHaveLength(7);
    expect(w.keys[6]).toBe('2026-10-01');
    expect(w.keys[0]).toBe('2026-09-25');
    expect(dayKey(w.prevStart)).toBe('2026-09-18');
  });

  it('countByDay bỏ qua ngày ngoài cửa sổ', () => {
    const keys = ['2026-09-30', '2026-10-01'];
    const dates = [new Date('2026-09-30T08:00:00'), new Date('2026-10-01T09:00:00'), new Date('2026-10-01T10:00:00'), new Date('2026-09-01T10:00:00')];
    expect(countByDay(dates, keys)).toEqual([1, 2]);
  });

  it('averageByDay giữ giá trị ngày trước khi thiếu dữ liệu', () => {
    const keys = ['2026-09-29', '2026-09-30', '2026-10-01'];
    const points = [{ at: new Date('2026-09-29T08:00:00'), value: 10 }, { at: new Date('2026-09-29T09:00:00'), value: 20 }, { at: new Date('2026-10-01T09:00:00'), value: 40 }];
    expect(averageByDay(points, keys)).toEqual([15, 15, 40]);
  });

  it('rate và isWeekend', () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(1, 0)).toBe(0);
    expect(isWeekend('2026-10-03')).toBe(true);
    expect(isWeekend('2026-10-01')).toBe(false);
  });

  it('trustScore: thiếu video → 92 điểm, chip "Chưa có video"', () => {
    const t = trustScore({ cccdVerified: true, phoneVerified: true, licensedPartners: 2, violations12m: 0, rating: 4.9, hasVideo: false });
    expect(t.score).toBe(92);
    expect(t.checks.find((c) => c.key === 'video')).toEqual({ key: 'video', label: 'Chưa có video giới thiệu', ok: false });
    expect(t.checks.some((c) => c.key === 'rating')).toBe(false);
  });

  it('trustScore: chưa xác minh gì → điểm thấp', () => {
    const t = trustScore({ cccdVerified: false, phoneVerified: true, licensedPartners: 0, violations12m: 1, rating: 3.5, hasVideo: false });
    expect(t.score).toBe(15);
  });
});
