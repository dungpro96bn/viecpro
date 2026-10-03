import { HttpStatus, Injectable } from '@nestjs/common';
import type { EmployerReviewCreateInput, EmployerReviewItem, EmployerReviewList, EmployerReviewMine, EmployerReviewReceipt, EmployerReviewResponseInput, PaginationQuery } from '@viecpro/shared';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { EmployerContext } from './employer-context.service.js';

@Injectable()
export class EmployerReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: EmployerContext) {}

  async list(userId: string, query: PaginationQuery): Promise<EmployerReviewList> {
    const actor = await this.ctx.resolve(userId);
    // Doanh nghiệp: chỉ đánh giá về thành viên của mình (không gồm NTD cá nhân đăng tin qua doanh nghiệp phái cử)
    const where = actor.employerId ? { employerId: actor.employerId, recruiter: { employerId: actor.employerId } } : { recruiterId: actor.recruiterId };
    const [rows, total, aggregate, distribution, awaitingResponse] = await Promise.all([
      this.prisma.employerReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
        select: { id: true, applicationId: true, rating: true, comment: true, response: true, createdAt: true, respondedAt: true, recruiter: { select: { name: true } } },
      }),
      this.prisma.employerReview.count({ where }),
      this.prisma.employerReview.aggregate({ where, _avg: { rating: true } }),
      this.prisma.employerReview.groupBy({ by: ['rating'], where, _count: { _all: true } }),
      this.prisma.employerReview.count({ where: { ...where, response: null } }),
    ]);
    const items: EmployerReviewItem[] = rows.map((review) => ({
      id: review.id,
      applicationId: review.applicationId,
      rating: review.rating,
      comment: review.comment,
      response: review.response,
      createdAt: review.createdAt.toISOString(),
      recruiterName: review.recruiter.name,
      recruiterResponseAt: review.respondedAt?.toISOString() ?? null,
    }));
    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
      average: aggregate._avg.rating ?? 0,
      distribution: Array.from({ length: 5 }, (_, i) => ({ rating: 5 - i, count: distribution.find((x) => x.rating === 5 - i)?._count._all ?? 0 })),
      awaitingResponse,
    };
  }

  async respond(userId: string, id: string, input: EmployerReviewResponseInput): Promise<void> {
    const actor = await this.ctx.resolve(userId);
    const where = actor.employerId ? { id, employerId: actor.employerId, recruiter: { employerId: actor.employerId } } : { id, recruiterId: actor.recruiterId };
    const { count } = await this.prisma.employerReview.updateMany({ where, data: { response: input.response, responseById: actor.recruiterId, respondedAt: new Date() } });
    if (!count) throw ApiException.notFound('Không tìm thấy đánh giá');
  }

  async submit(userId: string, applicationId: string, input: EmployerReviewCreateInput): Promise<EmployerReviewReceipt> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId, events: { some: { status: 'departed' } } },
      select: { id: true, job: { select: { recruiterId: true, employerId: true } }, employerReview: { select: { id: true } } },
    });
    if (!application) throw ApiException.notFound('Chỉ hồ sơ đã xuất cảnh qua viecpro mới được đánh giá');
    if (application.employerReview) throw new ApiException('CONFLICT', 'Hồ sơ này đã được đánh giá', HttpStatus.CONFLICT);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.employerReview.create({
        data: {
          applicationId,
          authorId: userId,
          recruiterId: application.job.recruiterId,
          employerId: application.job.employerId,
          rating: input.rating,
          comment: input.comment,
        },
        select: { id: true, rating: true, recruiterId: true },
      });
      const aggregate = await tx.employerReview.aggregate({ where: { recruiterId: review.recruiterId }, _avg: { rating: true }, _count: { _all: true } });
      await tx.recruiter.update({ where: { id: review.recruiterId }, data: { rating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count._all } });
      return { id: review.id, rating: review.rating };
    });
  }

  async mine(userId: string, applicationId: string): Promise<EmployerReviewMine | null> {
    const review = await this.prisma.employerReview.findFirst({ where: { applicationId, authorId: userId }, select: { id: true, rating: true } });
    return review;
  }
}
