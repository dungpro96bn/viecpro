import { companyProfileSchema, formatVnContactPhone, normalizeVnContactPhone } from '@viecpro/shared';

describe('số liên hệ doanh nghiệp', () => {
  it('chuẩn hoá di động, máy bàn về E.164; giữ hotline 1800 / 1900', () => {
    expect(normalizeVnContactPhone('024 7109 4510')).toBe('+842471094510');
    expect(normalizeVnContactPhone('+84 24 7109 4510')).toBe('+842471094510');
    expect(normalizeVnContactPhone('0912.345.678')).toBe('+84912345678');
    expect(normalizeVnContactPhone('1900 6699')).toBe('19006699');
    expect(normalizeVnContactPhone('12345')).toBeNull();
    expect(normalizeVnContactPhone('0123 456 789')).toBeNull();
  });

  it('hiển thị đúng dạng quen thuộc, giá trị cũ không chuẩn giữ nguyên', () => {
    expect(formatVnContactPhone('+842471094510')).toBe('024 7109 4510');
    expect(formatVnContactPhone('+84912345678')).toBe('0912 345 678');
    expect(formatVnContactPhone('19006699')).toBe('1900 6699');
    expect(formatVnContactPhone('024 7109 4510')).toBe('024 7109 4510');
  });

  it('hồ sơ công ty nhận số máy bàn (trước đây bị từ chối)', () => {
    const parsed = companyProfileSchema.parse({ phone: '024 7109 4510', sections: {} });
    expect(parsed.phone).toBe('+842471094510');
  });
});

describe('website doanh nghiệp', () => {
  it('tự thêm https:// cho tên miền trần, từ chối giá trị không phải website', () => {
    expect(companyProfileSchema.parse({ website: 'camcom.vn', sections: {} }).website).toBe('https://camcom.vn');
    expect(companyProfileSchema.parse({ website: 'http://camcom.vn/vi', sections: {} }).website).toBe('http://camcom.vn/vi');
    expect(companyProfileSchema.parse({ website: '', sections: {} }).website).toBeNull();
    expect(companyProfileSchema.safeParse({ website: 'khong-phai-url', sections: {} }).success).toBe(false);
  });
});
