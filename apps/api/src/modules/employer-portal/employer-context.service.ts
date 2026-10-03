import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { memberRemoved } from '../auth/login-guard.js';

/** Cán bộ tuyển dụng đang thao tác trong khu quản lý */
export interface EmployerActor {
  userId: string;
  recruiterId: string;
  /** null = NTD cá nhân (đăng tin qua doanh nghiệp phái cử) */
  employerId: string | null;
  /** Đã xác minh → tin hiển thị ngay, không chờ duyệt (RULE-BE.md mục 7) */
  verified: boolean;
}

/**
 * Xác định tài khoản NTD và phạm vi dữ liệu được xem (chống IDOR – RULE-BE.md mục 6 lớp 2):
 * - thành viên doanh nghiệp: mọi đơn / hồ sơ / lịch hẹn của doanh nghiệp
 * - NTD cá nhân: chỉ của chính mình
 */
@Injectable()
export class EmployerContext {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<EmployerActor> {
    const r = await this.prisma.recruiter.findUnique({
      where: { userId },
      select: {
        id: true,
        employerId: true,
        leftAt: true,
        employer: { select: { verified: true } },
        verifications: { where: { status: 'approved' }, select: { id: true }, take: 1 },
      },
    });
    if (!r) throw ApiException.forbidden('Tài khoản chưa được gắn với nhà tuyển dụng');
    if (r.leftAt) throw memberRemoved();
    return {
      userId,
      recruiterId: r.id,
      employerId: r.employerId,
      verified: !!r.employer?.verified || r.verifications.length > 0,
    };
  }

  /**
   * Mọi tin thuộc NTD, kể cả tin đã xoá vào Thùng rác (hồ sơ ứng tuyển, thống kê lịch sử, thùng rác).
   * Doanh nghiệp: chỉ tin do thành viên của chính doanh nghiệp đăng. Tin của NTD cá nhân đăng qua doanh nghiệp phái cử
   * cũng mang employerId của doanh nghiệp đó nhưng thuộc về NTD cá nhân – doanh nghiệp không được xem / sửa / thấy ứng viên.
   */
  ownerScope(actor: EmployerActor): Prisma.JobWhereInput {
    return actor.employerId ? { employerId: actor.employerId, recruiter: { employerId: actor.employerId } } : { recruiterId: actor.recruiterId };
  }

  /** Tin đang quản lý (chưa xoá) – danh sách tin, sửa, đẩy / ẩn / đóng tin */
  jobScope(actor: EmployerActor): Prisma.JobWhereInput {
    return { ...this.ownerScope(actor), deletedAt: null };
  }

  /** Tin của tư vấn viên cá nhân đang liên kết với công ty này – CHỈ dùng cho route đọc dành cho quản trị viên */
  partnerJobScope(actor: EmployerActor): Prisma.JobWhereInput {
    if (!actor.employerId) return { id: '__no_partner_jobs__' };
    return {
      employerId: actor.employerId,
      deletedAt: null,
      recruiter: {
        is: {
          employerId: null,
          partners: {
            some: {
              employerId: actor.employerId,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          },
        },
      },
    };
  }

  /** Hồ sơ ứng tuyển vẫn theo dõi được khi tin đã xoá (ứng viên có thể đang phỏng vấn / đã xuất cảnh) */
  applicationScope(actor: EmployerActor): Prisma.ApplicationWhereInput {
    return { job: this.ownerScope(actor) };
  }

  interviewScope(actor: EmployerActor): Prisma.InterviewWhereInput {
    return actor.employerId ? { employerId: actor.employerId } : { ownerId: actor.recruiterId };
  }

  /** Cán bộ cùng doanh nghiệp (chọn người phụ trách / người phỏng vấn); NTD cá nhân chỉ có chính mình */
  teamScope(actor: EmployerActor): Prisma.RecruiterWhereInput {
    return actor.employerId ? { employerId: actor.employerId, leftAt: null } : { id: actor.recruiterId };
  }
}
