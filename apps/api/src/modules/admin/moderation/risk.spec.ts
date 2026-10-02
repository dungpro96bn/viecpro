import { autoChecks, contentFlags, median, scoreJobRisk, type RiskInput } from './risk.js';

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

describe('contentFlags', () => {
  it('phát hiện từ khoá phí không phân biệt dấu', () => {
    expect(contentFlags('Ứng viên nộp PHÍ GIỮ CHỖ 500 USD').feeKeyword).toBe(true);
    expect(contentFlags('Cần đặt cọc trước khi thi tuyển').feeKeyword).toBe(true);
    expect(contentFlags('Chi phí xuất cảnh 0 USD, miễn phí').feeKeyword).toBe(false);
  });

  it('phát hiện SĐT / link trong nội dung', () => {
    expect(contentFlags('Liên hệ 0912 345 678 để biết thêm').contactInContent).toBe(true);
    expect(contentFlags('Xem tại zalo.me/abc').contactInContent).toBe(true);
    expect(contentFlags('Lương 180.000 yên, làm 8 tiếng').contactInContent).toBe(false);
    expect(contentFlags('{"salary":1840000000,"net":176000}').contactInContent).toBe(false);
    expect(contentFlags('Gọi +84912345678').contactInContent).toBe(true);
  });

  it('cờ nội dung đẩy điểm rủi ro', () => {
    expect(scoreJobRisk({ ...safe, feeKeyword: true }).flag).toBe('Thu phí ngoài bảng chi phí');
  });
});

describe('autoChecks', () => {
  it('đánh dấu lỗi / cần xem theo dữ liệu tin', () => {
    const checks = autoChecks({ ...safe, salary: 260_000, feeKeyword: true, feeUsd: null, employerVerified: false });
    const by = Object.fromEntries(checks.map((c) => [c.key, c.status]));
    expect(by).toMatchObject({ fee_keyword: 'fail', fee_disclosed: 'warn', salary: 'warn', verified: 'warn', contact: 'pass', reports: 'pass' });
    expect(checks.find((c) => c.key === 'salary')?.note).toContain('+44%');
  });
});
