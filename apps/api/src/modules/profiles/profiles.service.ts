import { Injectable } from '@nestjs/common';
import { maskVnPhone, type EmployerProfile, type Program, type RecruiterProfile } from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { employerSummarySelect, JobMapper, recruiterSummarySelect } from '../jobs/job.mapper.js';

type Target = { employerId: string } | { recruiterId: string };

/** Hồ sơ công khai nhà tuyển dụng (doanh nghiệp) và tư vấn viên (cá nhân) + theo dõi */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly mapper: JobMapper,
  ) {}

  /** Số đơn đang tuyển theo chương trình: { all: 8, tts: 4, tok: 2, ks: 2 } */
  private async jobCounts(where: Prisma.JobWhereInput) {
    const rows = await this.prisma.job.groupBy({ by: ['program'], where: { ...where, status: 'open' }, _count: { _all: true } });
    const counts: Partial<Record<Program | 'all', number>> = { all: 0 };
    for (const r of rows) {
      counts[r.program] = r._count._all;
      counts.all! += r._count._all;
    }
    return counts;
  }

  private async following(userId: string | undefined, target: Target) {
    if (!userId) return undefined;
    return !!(await this.prisma.follow.findFirst({ where: { userId, ...target }, select: { id: true } }));
  }

  async employer(slug: string, userId?: string): Promise<EmployerProfile> {
    const e = await this.prisma.employer.findUnique({
      where: { slug },
      include: { recruiters: { select: recruiterSummarySelect, orderBy: { rating: 'desc' } }, _count: { select: { followers: true } } },
    });
    if (!e) throw ApiException.notFound('Không tìm thấy nhà tuyển dụng');
    return {
      id: e.id,
      slug: e.slug,
      name: e.name,
      shortName: e.shortName,
      logoUrl: this.assets.url(e.logoUrl),
      coverUrl: this.assets.url(e.coverUrl),
      verified: e.verified,
      intro: e.intro,
      phone: e.phone,
      email: e.email,
      website: e.website,
      address: e.address,
      sections: (e.sections ?? {}) as Record<string, unknown>,
      team: e.recruiters.map((r) => this.mapper.recruiter(r)),
      followerCount: e._count.followers,
      following: await this.following(userId, { employerId: e.id }),
      jobCounts: await this.jobCounts({ employerId: e.id }),
    };
  }

  async recruiter(slug: string, userId?: string): Promise<RecruiterProfile> {
    const r = await this.prisma.recruiter.findUnique({
      where: { slug },
      include: { employer: { select: employerSummarySelect }, _count: { select: { followers: true } } },
    });
    if (!r) throw ApiException.notFound('Không tìm thấy tư vấn viên');
    return {
      ...this.mapper.recruiter(r),
      headline: r.headline,
      intro: r.intro,
      phoneMasked: r.phone ? maskVnPhone(r.phone) : null,
      employer: this.mapper.employer(r.employer),
      sections: (r.sections ?? {}) as Record<string, unknown>,
      followerCount: r._count.followers,
      following: await this.following(userId, { recruiterId: r.id }),
      jobCounts: await this.jobCounts({ recruiterId: r.id }),
    };
  }

  /** Số điện thoại đầy đủ – chỉ trả khi người xem đã đăng nhập (nút "bấm để hiện số") */
  async recruiterPhone(slug: string) {
    const r = await this.prisma.recruiter.findUnique({ where: { slug }, select: { phone: true } });
    if (!r?.phone) throw ApiException.notFound('Tư vấn viên chưa cập nhật số điện thoại');
    return { phone: r.phone };
  }

  private async resolve(kind: 'employer' | 'recruiter', slug: string): Promise<Target> {
    if (kind === 'employer') {
      const e = await this.prisma.employer.findUnique({ where: { slug }, select: { id: true } });
      if (!e) throw ApiException.notFound('Không tìm thấy nhà tuyển dụng');
      return { employerId: e.id };
    }
    const r = await this.prisma.recruiter.findUnique({ where: { slug }, select: { id: true } });
    if (!r) throw ApiException.notFound('Không tìm thấy tư vấn viên');
    return { recruiterId: r.id };
  }

  async follow(userId: string, kind: 'employer' | 'recruiter', slug: string) {
    const target = await this.resolve(kind, slug);
    const exists = await this.prisma.follow.findFirst({ where: { userId, ...target } });
    if (!exists) await this.prisma.follow.create({ data: { userId, ...target } });
  }

  async unfollow(userId: string, kind: 'employer' | 'recruiter', slug: string) {
    const target = await this.resolve(kind, slug);
    await this.prisma.follow.deleteMany({ where: { userId, ...target } });
  }
}
