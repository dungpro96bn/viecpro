import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { assertStillMember } from './login-guard.js';

const prismaWith = (left: boolean) => {
  const findFirst = vi.fn(async () => (left ? { id: 'r1' } : null));
  return { prisma: { recruiter: { findFirst } } as unknown as PrismaService, findFirst };
};

describe('assertStillMember', () => {
  it('chặn cán bộ đã bị gỡ khỏi doanh nghiệp với mã MEMBER_REMOVED', async () => {
    await expect(assertStillMember(prismaWith(true).prisma, { id: 'u1', role: 'employer' })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'MEMBER_REMOVED' }) });
  });

  it('cho qua thành viên đang hoạt động', async () => {
    await expect(assertStillMember(prismaWith(false).prisma, { id: 'u1', role: 'employer' })).resolves.toBeUndefined();
  });

  it('không truy vấn với tài khoản không phải NTD', async () => {
    const { prisma, findFirst } = prismaWith(true);
    await assertStillMember(prisma, { id: 'u1', role: 'seeker' });
    expect(findFirst).not.toHaveBeenCalled();
  });
});
