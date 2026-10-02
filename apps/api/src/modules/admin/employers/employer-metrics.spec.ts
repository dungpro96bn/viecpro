import type { AdminEmployerItem, AdminEmployerListQuery } from '@viecpro/shared';
import { deltaPercent, employerStatus, filterEmployers, isPaidPlan } from './employer-metrics.js';

const now = new Date('2026-10-01T00:00:00Z');
const item = (over: Partial<AdminEmployerItem>): AdminEmployerItem => ({
  key: 'company:x', kind: 'company', id: 'x', name: 'X', logoUrl: null, subtitle: 'MST 0109•••482 · Hà Nội', verified: true, reportCount: 0,
  openJobs: 1, totalJobs: 1, applicants30d: 0, applicantsDelta: null, responseRate: null, plan: null, status: 'active', ...over,
});
const query = (over: Partial<AdminEmployerListQuery>): AdminEmployerListQuery => ({
  page: 1, limit: 20, kind: 'all', tab: 'all', verified: false, paid: false, slowResponse: false, reported: false, sort: 'applicants', ...over,
});

describe('employer metrics', () => {
  it('trạng thái theo thứ tự ưu tiên', () => {
    expect(employerStatus({ suspended: true, verified: false, planExpiresAt: null }, now)).toBe('suspended');
    expect(employerStatus({ suspended: false, verified: false, planExpiresAt: null }, now)).toBe('pending');
    expect(employerStatus({ suspended: false, verified: true, planExpiresAt: new Date('2026-10-13T00:00:00Z') }, now)).toBe('expiring');
    expect(employerStatus({ suspended: false, verified: true, planExpiresAt: new Date('2027-03-01T00:00:00Z') }, now)).toBe('active');
    expect(employerStatus({ suspended: false, verified: true, planExpiresAt: new Date('2026-09-01T00:00:00Z') }, now)).toBe('active');
  });

  it('% thay đổi và gói trả phí', () => {
    expect(deltaPercent(112, 100)).toBe(12);
    expect(deltaPercent(5, 0)).toBeNull();
    expect(isPaidPlan('Gói Pro')).toBe(true);
    expect(isPaidPlan('Miễn phí')).toBe(false);
  });

  it('lọc theo loại, trạng thái, phản hồi chậm, tìm theo số', () => {
    const list = [
      item({ key: 'a', name: 'Sao Mai', applicants30d: 10, responseRate: 96 }),
      item({ key: 'b', name: 'Bình', kind: 'individual', subtitle: 'SĐT 098•••4521 · Nghệ An', applicants30d: 50, responseRate: 40 }),
      item({ key: 'c', name: 'Thành Đạt', status: 'suspended', reportCount: 4 }),
    ];
    expect(filterEmployers(list, query({})).map((i) => i.key)).toEqual(['b', 'a', 'c']);
    expect(filterEmployers(list, query({ kind: 'individual' })).map((i) => i.key)).toEqual(['b']);
    expect(filterEmployers(list, query({ slowResponse: true })).map((i) => i.key)).toEqual(['b']);
    expect(filterEmployers(list, query({ tab: 'suspended', reported: true })).map((i) => i.key)).toEqual(['c']);
    expect(filterEmployers(list, query({ q: '4521' })).map((i) => i.key)).toEqual(['b']);
  });
});
