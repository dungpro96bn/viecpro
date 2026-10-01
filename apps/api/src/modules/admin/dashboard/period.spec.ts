import { fillDays, pctChange, periodOf, vnDate, vnStartOfDay } from './period.js';

describe('period', () => {
  it('ngày theo giờ Việt Nam (UTC+7)', () => {
    // 18:30 UTC ngày 30/09 = 01:30 sáng 01/10 ở VN
    const d = new Date('2026-09-30T18:30:00Z');
    expect(vnDate(d)).toBe('2026-10-01');
    expect(vnStartOfDay(d).toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });

  it('30 ngày gồm hôm nay, kỳ trước liền kề', () => {
    const p = periodOf('30d', new Date('2026-10-01T03:00:00Z'));
    expect(p.chartDays).toHaveLength(30);
    expect(p.chartDays[0]).toBe('2026-09-02');
    expect(p.chartDays.at(-1)).toBe('2026-10-01');
    expect(p.prevFrom.toISOString()).toBe('2026-08-02T17:00:00.000Z');
  });

  it('"hôm nay" vẫn vẽ biểu đồ 7 ngày', () => {
    const p = periodOf('today', new Date('2026-10-01T03:00:00Z'));
    expect(p.days).toBe(1);
    expect(p.chartDays).toHaveLength(7);
  });

  it('pctChange và fillDays', () => {
    expect(pctChange(112, 100)).toBe(12);
    expect(pctChange(5, 0)).toBeNull();
    expect(fillDays(['a', 'b', 'c'], [{ d: 'b', c: 4 }])).toEqual([0, 4, 0]);
  });
});
