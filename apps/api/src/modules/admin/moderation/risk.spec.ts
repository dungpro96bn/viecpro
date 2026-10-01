import { median, scoreJobRisk, type RiskInput } from './risk.js';

const safe: RiskInput = { openReports: 0, employerVerified: true, employerAgeDays: 400, salary: 180_000, medianSalary: 180_000, duplicate: false };

describe('scoreJobRisk', () => {
  it('tin của DN đã xác minh, lương bình thường → rủi ro thấp, không cờ', () => {
    expect(scoreJobRisk(safe)).toEqual({ score: 5, flag: null, reasons: [] });
  });

  it('bị báo cáo là cờ chính, điểm cao', () => {
    const r = scoreJobRisk({ ...safe, openReports: 3, employerVerified: false });
    expect(r.flag).toBe('Bị báo cáo');
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it('lương lệch > 30% so với trung vị', () => {
    expect(scoreJobRisk({ ...safe, salary: 260_000 }).flag).toBe('Lương bất thường');
    expect(scoreJobRisk({ ...safe, salary: 220_000 }).flag).toBeNull();
  });

  it('"Chưa xác minh" chỉ là cờ chính khi không có lý do khác', () => {
    expect(scoreJobRisk({ ...safe, employerVerified: false }).flag).toBe('Chưa xác minh');
    expect(scoreJobRisk({ ...safe, employerVerified: false, employerAgeDays: 3 }).flag).toBe('DN mới');
  });

  it('điểm không vượt 100', () => {
    expect(scoreJobRisk({ openReports: 9, employerVerified: false, employerAgeDays: 1, salary: 500_000, medianSalary: 180_000, duplicate: true }).score).toBe(100);
  });
});

describe('median', () => {
  it('cần tối thiểu 3 giá trị', () => {
    expect(median([1, 2])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(3);
  });
});
