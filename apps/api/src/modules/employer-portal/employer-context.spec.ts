import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { EmployerContext, type EmployerActor } from './employer-context.service.js';

const ctx = new EmployerContext({} as PrismaService);
const company: EmployerActor = { userId: 'u1', recruiterId: 'r1', employerId: 'e1', verified: true };
const solo: EmployerActor = { userId: 'u2', recruiterId: 'r2', employerId: null, verified: true };

describe('EmployerContext – phạm vi dữ liệu (chống xem chéo giữa NTD)', () => {
  it('doanh nghiệp chỉ thấy tin do thành viên của chính mình đăng (không gồm NTD cá nhân đăng qua doanh nghiệp phái cử)', () => {
    expect(ctx.ownerScope(company)).toEqual({ employerId: 'e1', recruiter: { employerId: 'e1' } });
    expect(ctx.applicationScope(company)).toEqual({ job: { employerId: 'e1', recruiter: { employerId: 'e1' } } });
  });

  it('NTD cá nhân chỉ thấy tin của mình', () => {
    expect(ctx.ownerScope(solo)).toEqual({ recruiterId: 'r2' });
    expect(ctx.interviewScope(solo)).toEqual({ ownerId: 'r2' });
    expect(ctx.teamScope(solo)).toEqual({ id: 'r2' });
  });

  it('tin đang quản lý loại tin đã xoá; hồ sơ ứng tuyển vẫn theo dõi được khi tin đã xoá', () => {
    expect(ctx.jobScope(company)).toMatchObject({ deletedAt: null });
    expect(ctx.applicationScope(company).job).not.toHaveProperty('deletedAt');
  });
});
