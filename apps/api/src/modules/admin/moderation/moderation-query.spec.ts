import { moderationQueueSchema } from '@viecpro/shared';

describe('moderationQueueSchema', () => {
  it('đặt phân trang mặc định và chuẩn hoá nội dung tìm kiếm', () => {
    expect(moderationQueueSchema.parse({ q: '  Nexa  ' })).toEqual({ page: 1, limit: 20, q: 'Nexa', tab: 'pending' });
  });

  it('giới hạn số dòng và độ dài từ khoá', () => {
    expect(moderationQueueSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(moderationQueueSchema.safeParse({ q: 'a'.repeat(121) }).success).toBe(false);
  });
});
