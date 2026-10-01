import { Injectable } from '@nestjs/common';
import type { EmployerAccount } from '@viecpro/shared';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';

const WEEK = 7 * 86400_000;

/** Khung trang khu NTD: thông tin tài khoản, doanh nghiệp, gói dịch vụ, số trên menu */
@Injectable()
export class EmployerAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
  ) {}

  async account(userId: string): Promise<EmployerAccount> {
    const actor = await this.ctx.resolve(userId);
    const jobScope = this.ctx.jobScope(actor);
    const now = new Date();

    const [user, recruiter, plan, jobs, jobsVisible, newApplicants, upcomingInterviews, partners] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, avatarUrl: true } }),
      this.prisma.recruiter.findUniqueOrThrow({
        where: { id: actor.recruiterId },
        select: {
          slug: true,
          title: true,
          photoUrl: true,
          reviewCount: true,
          cccdVerifiedAt: true,
          employer: { select: { id: true, slug: true, name: true, shortName: true, logoUrl: true, verified: true, _count: { select: { recruiters: true } } } },
        },
      }),
      this.planOf(actor),
      this.prisma.job.count({ where: jobScope }),
      this.prisma.job.count({ where: { ...jobScope, status: 'open' } }),
      this.prisma.application.count({ where: { ...this.ctx.applicationScope(actor), status: 'submitted' } }),
      this.prisma.interview.count({ where: { ...this.ctx.interviewScope(actor), status: 'scheduled', startAt: { gte: now, lte: new Date(now.getTime() + WEEK) } } }),
      actor.employerId ? Promise.resolve(0) : this.prisma.recruiterPartner.count({ where: { recruiterId: actor.recruiterId } }),
    ]);

    const e = recruiter.employer;
    return {
      user: { id: user.id, name: user.name, avatarUrl: this.assets.url(user.avatarUrl ?? recruiter.photoUrl), title: recruiter.title },
      recruiter: { id: actor.recruiterId, slug: recruiter.slug },
      kind: actor.employerId ? 'company' : 'individual',
      company: e
        ? { id: e.id, slug: e.slug, name: e.name, shortName: e.shortName, logoUrl: this.assets.url(e.logoUrl), verified: e.verified, memberCount: e._count.recruiters }
        : null,
      cccdVerified: !!recruiter.cccdVerifiedAt,
      plan: plan && { name: plan.name, expiresAt: plan.expiresAt.toISOString(), jobQuota: plan.jobQuota, jobsVisible, boostQuota: plan.boostQuota, boostsUsed: plan.boostsUsed },
      counts: { jobs, newApplicants, upcomingInterviews, partners, reviews: recruiter.reviewCount },
    };
  }

  /** Gói của doanh nghiệp (thành viên dùng chung) hoặc của NTD cá nhân */
  planOf(actor: EmployerActor) {
    return this.prisma.businessPlan.findFirst({ where: actor.employerId ? { employerId: actor.employerId } : { recruiterId: actor.recruiterId } });
  }
}
