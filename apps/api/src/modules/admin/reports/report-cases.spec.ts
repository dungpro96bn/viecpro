import { type CaseReport, caseDueAt, caseSeverity, comparePriority, groupCases } from './report-cases.js';

let n = 0;
const r = (over: Partial<CaseReport>): CaseReport => ({
  id: `r${++n}`, number: n, targetType: 'job', jobId: 'j1', employerId: null, recruiterId: null, targetUserId: null,
  reason: 'fee', severity: 'critical', status: 'open', dueAt: new Date('2026-10-01T02:00:00Z'), createdAt: new Date(`2026-10-01T00:0${n % 10}:00Z`), resolvedAt: null, ...over,
});

describe('gộp vụ báo cáo', () => {
  it('cùng đối tượng + lý do + nhóm trạng thái thành một vụ', () => {
    const cases = groupCases([r({}), r({ status: 'investigating' }), r({ reason: 'duplicate', severity: 'low' }), r({ jobId: 'j2' }), r({ status: 'resolved' })]);
    expect(cases.map((c) => c.length).sort((a, b) => a - b)).toEqual([1, 1, 1, 2]);
  });

  it('mức độ cao nhất, hạn sớm nhất, ưu tiên nghiêm trọng trước', () => {
    const a = [r({ severity: 'medium', dueAt: new Date('2026-10-02T00:00:00Z') }), r({ severity: 'high', dueAt: new Date('2026-10-01T05:00:00Z') })];
    const b = [r({ severity: 'critical', dueAt: new Date('2026-10-03T00:00:00Z') })];
    expect(caseSeverity(a)).toBe('high');
    expect(caseDueAt(a)?.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect([a, b].sort(comparePriority)[0]).toBe(b);
  });
});
