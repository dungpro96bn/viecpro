import { Injectable } from '@nestjs/common';
import {
  PREFECTURES_BY_REGION,
  PROGRAMS,
  REGIONS,
  REGION_LABEL,
  type Gender,
  type Industry,
  type JobDetail,
  type JobFacets,
  type JobListItem,
  type JobSearchQuery,
  type JobTag,
  type Paginated,
  type PaginationQuery,
  type RegionDirectoryItem,
} from '@viecpro/shared';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { matchJob } from './job-match.js';
import { buildJobOrder, buildJobWhere } from './job-query.js';
import { jobInclude, PUBLIC_JOB_WHERE, JobMapper } from './job.mapper.js';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: JobMapper,
  ) {}

  /** Gắn cờ "đã lưu" cho danh sách khi người dùng đã đăng nhập */
  async withSaved<T extends { id: string }>(items: T[], userId?: string): Promise<Array<T & { saved?: boolean }>> {
    if (!userId || items.length === 0) return items;
    const saved = await this.prisma.savedJob.findMany({ where: { userId, jobId: { in: items.map((i) => i.id) } }, select: { jobId: true } });
    const ids = new Set(saved.map((s) => s.jobId));
    return items.map((i) => ({ ...i, saved: ids.has(i.id) }));
  }

  async search(query: JobSearchQuery, userId?: string): Promise<Paginated<JobListItem>> {
    const where = buildJobWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({ where, include: jobInclude, orderBy: buildJobOrder(query.sort), ...pageArgs(query) }),
      this.prisma.job.count({ where }),
    ]);
    return paginated(await this.withSaved(rows.map((r) => this.mapper.listItem(r)), userId), total, query);
  }

  /** Số đơn theo từng bộ lọc (con số bên cạnh checkbox ở trang tìm kiếm) */
  async facets(): Promise<JobFacets> {
    const where = { status: 'open' as const };
    const [total, byProgram, byRegion, byIndustry, tagRows] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.groupBy({ by: ['program'], where, _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['region'], where, _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['industry'], where, _count: { _all: true }, orderBy: { _count: { industry: 'desc' } } }),
      this.prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
        SELECT unnest(tags) AS tag, COUNT(*) AS count FROM "Job" WHERE status = 'open' GROUP BY tag ORDER BY count DESC`,
    ]);

    const programs = Object.fromEntries(PROGRAMS.map((p) => [p, 0])) as JobFacets['programs'];
    for (const r of byProgram) programs[r.program] = r._count._all;
    const regions = Object.fromEntries(REGIONS.map((r) => [r, 0])) as JobFacets['regions'];
    for (const r of byRegion) regions[r.region] = r._count._all;

    return {
      total,
      programs,
      regions,
      industries: byIndustry.map((r) => ({ industry: r.industry as Industry, count: r._count._all })),
      tags: tagRows.map((r) => ({ tag: r.tag as JobTag, count: Number(r.count) })),
    };
  }

  /** Danh bạ tỉnh thành ở trang chủ */
  async regionDirectory(): Promise<RegionDirectoryItem[]> {
    const counts = await this.prisma.job.groupBy({ by: ['pref'], where: { status: 'open' }, _count: { _all: true } });
    const byPref = new Map(counts.map((c) => [c.pref, c._count._all]));
    return REGIONS.map((key) => {
      const prefs = PREFECTURES_BY_REGION[key]
        .map((name) => ({ name, count: byPref.get(name) ?? 0 }))
        .filter((p) => p.count > 0)
        .sort((a, b) => b.count - a.count);
      return { key, name: REGION_LABEL[key], total: prefs.reduce((s, p) => s + p.count, 0), prefs };
    });
  }

  async getBySlug(slug: string, userId?: string): Promise<JobDetail> {
    // Chỉ tin đã duyệt mới công khai: nháp / chờ duyệt / bị từ chối trả 404 (RULE-BE.md mục 7)
    const job = await this.prisma.job.findFirst({ where: { slug, ...PUBLIC_JOB_WHERE }, include: jobInclude });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');

    // Đếm lượt xem (chỉ tin đang tuyển) không chặn response
    if (job.status === 'open') void this.prisma.job.update({ where: { id: job.id }, data: { views: { increment: 1 } } }).catch(() => undefined);

    const detail = this.mapper.detail(job);
    if (!userId) return detail;
    const [saved, applied] = await Promise.all([
      this.prisma.savedJob.findUnique({ where: { userId_jobId: { userId, jobId: job.id } } }),
      this.prisma.application.findFirst({ where: { userId, jobId: job.id, status: { not: 'withdrawn' } }, select: { id: true } }),
    ]);
    return { ...detail, saved: !!saved, applied: !!applied };
  }

  /** "Đơn hàng tương tự": cùng chương trình hoặc ngành, ưu tiên cùng vùng */
  async similar(slug: string, limit = 8): Promise<JobListItem[]> {
    const job = await this.prisma.job.findFirst({ where: { slug, ...PUBLIC_JOB_WHERE }, select: { id: true, program: true, industry: true, region: true } });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');
    const rows = await this.prisma.job.findMany({
      where: { status: 'open', id: { not: job.id }, OR: [{ program: job.program }, { industry: job.industry }] },
      include: jobInclude,
      orderBy: [{ publishedAt: 'desc' }],
      take: limit * 3,
    });
    return rows
      .sort((a, b) => Number(b.region === job.region) - Number(a.region === job.region))
      .slice(0, limit)
      .map((r) => this.mapper.listItem(r));
  }

  /** Việc làm phù hợp nhất với hồ sơ ứng viên, kèm % phù hợp */
  async recommended(userId: string, query: PaginationQuery): Promise<Paginated<JobListItem>> {
    const p = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    const profile = {
      birthYear: p?.birthYear ?? null,
      gender: (p?.gender ?? null) as Gender | null,
      programs: p?.programs ?? [],
      industries: p?.industries ?? [],
      prefs: p?.prefs ?? [],
    };

    // Lọc thô bằng điều kiện cứng (tuổi, giới tính) rồi chấm điểm trong bộ nhớ
    const where = buildJobWhere({
      sort: 'newest',
      page: 1,
      limit: 1,
      birthYear: profile.birthYear ?? undefined,
      gender: profile.gender ?? undefined,
      program: profile.programs.length ? profile.programs : undefined,
    });
    const rows = await this.prisma.job.findMany({ where, include: jobInclude, orderBy: { publishedAt: 'desc' }, take: 200 });
    const scored = rows
      .map((row) => ({ row, ...matchJob(profile, row) }))
      .sort((a, b) => b.score - a.score);

    const { skip, take } = pageArgs(query);
    const items = scored.slice(skip, skip + take).map(({ row, score, reasons }) => ({ ...this.mapper.listItem(row), matchScore: score, matchReasons: reasons }));
    return paginated(await this.withSaved(items, userId), scored.length, query);
  }

  /** Số đơn mới (7 ngày) phù hợp tuổi / giới tính / chương trình – cho lời chào trên trang tài khoản */
  /** Đơn đang tuyển hợp tuổi, giới tính, chương trình và ngành quan tâm */
  async countMatching(userId: string): Promise<number> {
    const p = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    const where = buildJobWhere({
      sort: 'newest',
      page: 1,
      limit: 1,
      birthYear: p?.birthYear ?? undefined,
      gender: p?.gender ?? undefined,
      program: p?.programs.length ? p.programs : undefined,
      industry: p?.industries.length ? (p.industries as Industry[]) : undefined,
    });
    return this.prisma.job.count({ where });
  }

  async countNewMatching(userId: string): Promise<number> {
    const p = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    const where = buildJobWhere({
      sort: 'newest',
      page: 1,
      limit: 1,
      birthYear: p?.birthYear ?? undefined,
      gender: p?.gender ?? undefined,
      program: p?.programs.length ? p.programs : undefined,
    });
    return this.prisma.job.count({ where: { AND: [where, { publishedAt: { gte: new Date(Date.now() - 7 * 86400_000) } }] } });
  }
}
