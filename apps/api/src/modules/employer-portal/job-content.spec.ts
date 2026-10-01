import { jobPostingSchema } from '@viecpro/shared';
import { buildJobContent, deriveTags, expectedIncome, netIncome, type JobFormFacts } from './job-content.js';

const now = new Date('2026-10-01T10:00:00');
const base: JobFormFacts = {
  program: 'tts',
  industry: 'Điện tử – Lắp ráp',
  pref: 'Saitama',
  position: 'Lắp ráp bảng mạch',
  salary: 190000,
  gender: 'nu',
  birthYearFrom: 1996,
  birthYearTo: 2008,
  departureAt: new Date('2027-03-01'),
  examAt: new Date('2026-10-15'),
  feeUsd: 5500,
  contractYears: 3,
  jlptRequired: null,
  posting: jobPostingSchema.parse({
    description: '• Lắp ráp linh kiện điện tử\n• Kiểm tra ngoại quan sản phẩm',
    otherRequirements: ['Khéo tay', 'Thị lực tốt'],
    educationMin: 'thpt',
    overtimeHours: 30,
    benefits: ['Hỗ trợ nhà ở', 'Bảo hiểm đầy đủ'],
  }),
};

describe('job-content', () => {
  it('thu nhập dự kiến cộng tăng ca, thực lĩnh ~74%', () => {
    expect(expectedIncome(190000, 0)).toEqual({ low: 190000, high: 200000 });
    expect(expectedIncome(190000, 30).low).toBeGreaterThan(190000);
    expect(netIncome(190000)).toBe(141000);
  });

  it('dựng nội dung chi tiết từ form', () => {
    const c = buildJobContent(base, now);
    expect(c.tasks).toEqual(['Lắp ráp linh kiện điện tử', 'Kiểm tra ngoại quan sản phẩm']);
    expect(c.requirements).toContainEqual(['Giới tính', 'Nữ']);
    expect(c.requirements).toContainEqual(['Độ tuổi', '18 – 30 tuổi (sinh năm 1996 – 2008)']);
    expect(c.requirements).toContainEqual(['Yêu cầu khác', 'Khéo tay, Thị lực tốt']);
    expect(c.contract).toBe('3 năm');
    expect(c.recruitment).toBe('Thi tuyển ngày 15/10/2026');
    expect(c.benefits).toEqual(['Hỗ trợ nhà ở', 'Bảo hiểm đầy đủ']);
    expect(c.posting?.overtimeHours).toBe(30);
  });

  it('suy ra nhãn: miễn phí, lương cao, tăng ca nhiều, xuất cảnh nhanh', () => {
    const tags = deriveTags({ ...base, feeUsd: 0, departureAt: new Date('2026-12-01'), posting: { ...base.posting, overtimeHours: 45 } }, 170000, 190000, now);
    expect(tags).toEqual(['Đơn miễn phí', 'Lương cao', 'Tăng ca nhiều', 'Xuất cảnh nhanh']);
  });

  it('chi phí thấp → "Phí thấp", không có trung vị → không gắn "Lương cao"', () => {
    expect(deriveTags({ ...base, feeUsd: 2500 }, null, 300000, now)).toEqual(['Phí thấp']);
  });
});
