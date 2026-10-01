import { Injectable } from '@nestjs/common';
import type { Gender, Industry, SavedJobItem, SavedJobList, SavedJobListQuery, SavedJobState } from '@viecpro/shared';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { jobInclude, JobMapper, PUBLIC_JOB_STATUSES } from '../jobs/job.mapper.js';
import { matchJob } from '../jobs/job-match.js';
import { daysLeft, savedJobInsight } from './saved-job-insight.js';

/** Danh sách đã lưu thường nhỏ – chấm điểm, sắp xếp trong bộ nhớ (tối đa 200 việc gần nhất) */
const MAX_SAVED = 200;

@Injectable()
export class SavedJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: JobMapper,
  ) {}

  /** Việc đã lưu kèm % phù hợp, điều kiện so với hồ sơ, nhãn nổi bật (design 20) */
  async list(userId: string, query: SavedJobListQuery): Promise<SavedJobList> {
    const now = new Date();
    // Đơn bị gỡ / chuyển về chờ duyệt sau khi lưu thì không hiện nữa
    const [rows, p] = await Promise.all([
      this.prisma.savedJob.findMany({
        where: { userId, job: { status: { in: PUBLIC_JOB_STATUSES } } },
        include: { job: { include: jobInclude } },
        orderBy: { createdAt: 'desc' },
        take: MAX_SAVED,
      }),
      this.prisma.seekerProfile.findUnique({ where: { userId } }),
    ]);
    const jobIds = rows.map((r) => r.jobId);
    const [applied, passed] = await Promise.all([
      this.prisma.application.findMany({ where: { userId, jobId: { in: jobIds }, status: { not: 'withdrawn' } }, select: { jobId: true } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: { jobId: { in: jobIds }, status: { in: ['passed', 'departed'] } }, _count: { _all: true } }),
    ]);
    const appliedSet = new Set(applied.map((a) => a.jobId));
    const passedBy = new Map(passed.map((g) => [g.jobId, g._count._all]));
    const profile = {
      birthYear: p?.birthYear ?? null,
      gender: (p?.gender ?? null) as Gender | null,
      programs: p?.programs ?? [],
      industries: p?.industries ?? [],
      prefs: p?.prefs ?? [],
      jlpt: p?.jlpt ?? null,
      jlptLearning: p?.jlptLearning ?? null,
    };

    const all: SavedJobItem[] = rows.map(({ job, createdAt }) => {
      const { score, reasons } = matchJob(profile, job);
      return {
        ...this.mapper.listItem(job),
        saved: true,
        matchScore: score,
        matchReasons: reasons,
        savedAt: createdAt.toISOString(),
        feeUsd: job.feeUsd,
        contractYears: job.contractYears,
        jlptRequired: job.jlptRequired,
        applied: appliedSet.has(job.id),
        ...savedJobInsight(profile, job, passedBy.get(job.id) ?? 0, now),
      };
    });

    const industries = [...all.reduce((m, j) => m.set(j.industry, (m.get(j.industry) ?? 0) + 1), new Map<Industry, number>())].map(([industry, count]) => ({ industry, count }));
    const expiringSoon = rows
      .map(({ job }, i) => ({ job, item: all[i]!, left: daysLeft(job.deadline, now) }))
      .filter((x) => x.job.status === 'open' && x.left !== null && x.left >= 0 && x.left <= 3 && !x.item.applied && x.item.eligible)
      .sort((a, b) => a.left! - b.left!)
      .map((x) => ({ id: x.job.id, title: x.job.title, pref: x.job.pref, imageUrl: x.item.imageUrl, daysLeft: x.left! }));

    const far = Number.MAX_SAFE_INTEGER;
    const sorted = all
      .filter((j) => !query.industry || j.industry === query.industry)
      .sort((a, b) =>
        query.sort === 'salary'
          ? b.salary - a.salary
          : query.sort === 'match'
            ? (b.matchScore ?? 0) - (a.matchScore ?? 0)
            : // Sắp hết hạn: còn hạn gần nhất lên đầu, không có hạn xuống cuối
              (a.deadline ? Date.parse(a.deadline) : far) - (b.deadline ? Date.parse(b.deadline) : far),
      );
    const start = (query.page - 1) * query.limit;
    return {
      items: sorted.slice(start, start + query.limit),
      page: query.page,
      limit: query.limit,
      total: sorted.length,
      hasMore: start + query.limit < sorted.length,
      industries,
      expiringSoon,
    };
  }

  async save(userId: string, jobKey: string): Promise<void> {
    const job = await this.findJob(jobKey);
    await this.prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId: job.id } },
      create: { userId, jobId: job.id },
      update: {},
    });
  }

  async state(userId: string, jobKey: string): Promise<SavedJobState> {
    const saved = await this.prisma.savedJob.findFirst({ where: { userId, job: { OR: [{ id: jobKey }, { slug: jobKey }] } }, select: { jobId: true } });
    return { saved: !!saved };
  }

  async unsave(userId: string, jobKey: string): Promise<void> {
    const job = await this.prisma.job.findFirst({ where: { OR: [{ id: jobKey }, { slug: jobKey }] }, select: { id: true } });
    if (!job) return;
    await this.prisma.savedJob.deleteMany({ where: { userId, jobId: job.id } });
  }

  private async findJob(jobKey: string) {
    const job = await this.prisma.job.findFirst({ where: { OR: [{ id: jobKey }, { slug: jobKey }], status: { in: PUBLIC_JOB_STATUSES } }, select: { id: true } });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');
    return job;
  }
}
