import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

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
        cccdVerifiedAt: true,
        employer: { select: { verified: true } },
        verifications: { where: { status: 'approved' }, select: { id: true }, take: 1 },
      },
    });
    if (!r) throw ApiException.forbidden('Tài khoản chưa được gắn với nhà tuyển dụng');
    return {
      userId,
      recruiterId: r.id,
      employerId: r.employerId,
      verified: !!r.employer?.verified || r.verifications.length > 0,
    };
  }

  jobScope(actor: EmployerActor): Prisma.JobWhereInput {
    return actor.employerId ? { employerId: actor.employerId } : { recruiterId: actor.recruiterId };
  }

  applicationScope(actor: EmployerActor): Prisma.ApplicationWhereInput {
    return { job: this.jobScope(actor) };
  }

  interviewScope(actor: EmployerActor): Prisma.InterviewWhereInput {
    return actor.employerId ? { employerId: actor.employerId } : { ownerId: actor.recruiterId };
  }

  /** Cán bộ cùng doanh nghiệp (chọn người phụ trách / người phỏng vấn); NTD cá nhân chỉ có chính mình */
  teamScope(actor: EmployerActor): Prisma.RecruiterWhereInput {
    return actor.employerId ? { employerId: actor.employerId } : { id: actor.recruiterId };
  }
}
