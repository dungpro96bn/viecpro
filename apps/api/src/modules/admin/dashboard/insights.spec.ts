import { buildInsights, csvCell } from './insights.js';

describe('buildInsights', () => {
  it('luôn trả 3 mục theo thứ tự hàng chờ – báo cáo – ngành', () => {
    const r = buildInsights({
      pending: 23,
      nearSla: 5,
      submittedLast24h: 14,
      submittedPrev24h: 10,
      topReport: { reason: 'Thu phí ngoài hợp đồng', employers: 3, hiddenJobs: 7 },
      topIndustry: { industry: 'Điều dưỡng – Kaigo', growth: 22 },
    });
    expect(r.map((x) => x.title)).toEqual(['Hàng chờ tăng 40%', '3 DN bị báo "thu phí ngoài hợp đồng"', 'Điều dưỡng – Kaigo tăng mạnh']);
    expect(r[0]!.body).toContain('Đề xuất thêm 1 kiểm duyệt viên');
  });

  it('trạng thái tốt khi không có việc tồn', () => {
    const r = buildInsights({ pending: 0, nearSla: 0, submittedLast24h: 0, submittedPrev24h: 0, topReport: null, topIndustry: null });
    expect(r).toHaveLength(3);
    expect(r[0]!.title).toBe('Hàng chờ đã trống');
    expect(r[1]!.title).toBe('Không có báo cáo mới');
  });
});

describe('csvCell', () => {
  it('chặn chèn công thức Excel và escape dấu phẩy / ngoặc kép', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(-3.5)).toBe('-3.5');
    expect(csvCell(null)).toBe('');
  });
});
