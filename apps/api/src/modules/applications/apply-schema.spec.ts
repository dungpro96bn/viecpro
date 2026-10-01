import { applySchema } from '@viecpro/shared';

const validInput = {
  fullName: 'Nguyễn Thị Lan',
  phone: '0912345678',
  email: 'Lan.Nguyen@Gmail.com ',
  birthYear: 1998,
  gender: 'nu' as const,
};

describe('applySchema', () => {
  it('giữ tương thích với client gửi jobId', () => {
    expect(applySchema.parse({ ...validInput, jobId: 'job_123' })).toMatchObject({ jobId: 'job_123', phone: '+84912345678' });
  });

  it('chấp nhận slug đơn hàng từ giao diện web demo', () => {
    expect(applySchema.parse({ ...validInput, jobSlug: 'don-hang-demo-123' })).toMatchObject({ jobSlug: 'don-hang-demo-123' });
  });

  it('từ chối yêu cầu không có mã đơn hàng', () => {
    expect(applySchema.safeParse(validInput).success).toBe(false);
  });

  it('email bắt buộc (nhận mã OTP), chuẩn hoá chữ thường; mã gồm đúng 6 số', () => {
    const { email: _omit, ...noEmail } = validInput;
    expect(applySchema.safeParse({ ...noEmail, jobId: 'job_123' }).success).toBe(false);
    expect(applySchema.parse({ ...validInput, jobId: 'job_123', emailCode: '012345' })).toMatchObject({ email: 'lan.nguyen@gmail.com', emailCode: '012345' });
    expect(applySchema.safeParse({ ...validInput, jobId: 'job_123', emailCode: '12345' }).success).toBe(false);
  });

  it('giới hạn độ dài slug', () => {
    expect(applySchema.safeParse({ ...validInput, jobSlug: 'x'.repeat(181) }).success).toBe(false);
  });
});
