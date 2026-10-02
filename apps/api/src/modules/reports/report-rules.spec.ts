import { dueAtFor, severityOf, shouldAutoHide } from './report-rules.js';

describe('report rules', () => {
  it('mức độ theo lý do, lý do lạ là trung bình', () => {
    expect(severityOf('fee')).toBe('critical');
    expect(severityOf('scam')).toBe('critical');
    expect(severityOf('harassment')).toBe('high');
    expect(severityOf('duplicate')).toBe('low');
    expect(severityOf('Thu phí ngoài hợp đồng')).toBe('medium');
  });

  it('hạn xử lý theo SLA', () => {
    const from = new Date('2026-10-01T00:00:00Z');
    expect(dueAtFor('critical', from).toISOString()).toBe('2026-10-01T02:00:00.000Z');
    expect(dueAtFor('low', from).toISOString()).toBe('2026-10-04T00:00:00.000Z');
  });

  it('tự ẩn khi đủ 3 người báo thu phí', () => {
    expect(shouldAutoHide(2)).toBe(false);
    expect(shouldAutoHide(3)).toBe(true);
  });
});
