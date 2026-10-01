import { describe, expect, it } from 'vitest';
import { savedJobInsight, type InsightJob, type InsightProfile } from './saved-job-insight.js';

const now = new Date('2026-10-01T10:00:00');
const lan: InsightProfile = { birthYear: 1999, gender: 'nu', industries: ['Điện tử – Lắp ráp'], jlpt: null, jlptLearning: 'N5' };
const job: InsightJob = { birthYearFrom: 1996, birthYearTo: 2008, gender: 'nu', industry: 'Điện tử – Lắp ráp', jlptRequired: null, feeUsd: 4800, quantity: 12, deadline: null };

describe('savedJobInsight', () => {
  it('khớp đủ: đủ điều kiện, câu xanh', () => {
    const r = savedJobInsight(lan, job, 0, now);
    expect(r.eligible).toBe(true);
    expect(r.matchNote).toEqual({ ok: true, text: 'Khớp giới tính, độ tuổi và ngành bạn mong muốn' });
  });

  it('đơn chỉ tuyển nam: không đủ điều kiện, nhãn "Chỉ tuyển nam"', () => {
    const r = savedJobInsight(lan, { ...job, gender: 'nam' }, 0, now);
    expect(r.eligible).toBe(false);
    expect(r.highlight).toEqual({ kind: 'gender', text: 'Chỉ tuyển nam' });
  });

  it('cần N4 khi đang học N5: vẫn ứng tuyển được nhưng cảnh báo', () => {
    const r = savedJobInsight(lan, { ...job, gender: 'both', jlptRequired: 'N4' }, 0, now);
    expect(r.eligible).toBe(true);
    expect(r.matchNote).toEqual({ ok: false, text: 'Cần tiếng Nhật N4 – bạn đang học N5' });
  });

  it('ưu tiên nhãn sắp hết hạn, sau đó miễn phí, rồi chỉ tiêu còn ít', () => {
    expect(savedJobInsight(lan, { ...job, deadline: new Date('2026-10-03T12:00:00') }, 0, now).highlight).toEqual({ kind: 'expiring', text: 'Hết hạn sau 3 ngày' });
    expect(savedJobInsight(lan, { ...job, gender: 'both', feeUsd: 0 }, 0, now).highlight?.kind).toBe('free');
    expect(savedJobInsight(lan, { ...job, gender: 'both' }, 7, now).highlight).toEqual({ kind: 'quota', text: 'Còn 5/12 chỉ tiêu' });
  });
});
