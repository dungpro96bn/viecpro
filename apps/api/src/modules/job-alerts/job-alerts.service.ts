import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MAX_JOB_ALERTS,
  type AlertChannel,
  type AlertFeedItem,
  type Gender,
  type JobAlertCriteria,
  type JobAlertInput,
  type JobAlertItem,
  type JobAlertList,
  type JobAlertSuggestion,
  type JobAlertUpdateInput,
  type JobListItem,
  type Paginated,
  type PaginationQuery,
} from '@viecpro/shared';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { JobAlert, Prisma } from '../../generated/prisma/client.js';
import { matchJob } from '../jobs/job-match.js';
import { jobInclude, JobMapper } from '../jobs/job.mapper.js';
import { JobsService } from '../jobs/jobs.service.js';
import { criteriaChips, criteriaWhere, defaultAlertName, parseCriteria } from './alert-criteria.js';

const DAY = 86400_000;

/** Thông báo việc làm của ứng viên (design 04 – C-05, spec 3.12) */
@Injectable()
export class JobAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: JobMapper,
    private readonly jobsService: JobsService,
  ) {}

  private async toItem(a: JobAlert): Promise<JobAlertItem> {
    const criteria = parseCriteria(a.criteria);
    const newCount = await this.prisma.job.count({ where: criteriaWhere(criteria, a.lastSeenAt) });
    return {
      id: a.id,
      name: a.name,
      criteria,
      chips: criteriaChips(criteria),
      channels: a.channels as AlertChannel[],
      frequency: a.frequency,
      enabled: a.enabled,
      newCount,
      lastSentAt: a.lastSentAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  }

  /** Lấy thông báo của chính người dùng – không có hoặc của người khác đều 404 (RULE-BE.md mục 6 lớp 2) */
  private async own(userId: string, id: string): Promise<JobAlert> {
    const alert = await this.prisma.jobAlert.findFirst({ where: { id, userId } });
    if (!alert) throw ApiException.notFound('Không tìm thấy thông báo việc làm');
    return alert;
  }

  async list(userId: string): Promise<JobAlertList> {
    const rows = await this.prisma.jobAlert.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    const items = await Promise.all(rows.map((r) => this.toItem(r)));
    return {
      items,
      total: items.length,
      enabledCount: items.filter((i) => i.enabled).length,
      unseen: items.filter((i) => i.enabled).reduce((s, i) => s + i.newCount, 0),
      max: MAX_JOB_ALERTS,
    };
  }

  async create(userId: string, input: JobAlertInput): Promise<JobAlertItem> {
    const count = await this.prisma.jobAlert.count({ where: { userId } });
    if (count >= MAX_JOB_ALERTS) throw new ApiException('ALERT_LIMIT', `Bạn chỉ tạo được tối đa ${MAX_JOB_ALERTS} thông báo việc làm`, HttpStatus.CONFLICT);
    const alert = await this.prisma.jobAlert.create({
      data: {
        userId,
        name: input.name || defaultAlertName(input.criteria),
        criteria: input.criteria as Prisma.InputJsonValue,
        channels: [...new Set(input.channels)],
        frequency: input.frequency,
        enabled: input.enabled,
        // Tạo xong mới tính "việc mới" – không gửi dồn tin cũ
        lastSentAt: new Date(),
      },
    });
    return this.toItem(alert);
  }

  async update(userId: string, id: string, input: JobAlertUpdateInput): Promise<JobAlertItem> {
    const alert = await this.own(userId, id);
    const updated = await this.prisma.jobAlert.update({
      where: { id: alert.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.criteria && { criteria: input.criteria as Prisma.InputJsonValue }),
        ...(input.channels && { channels: [...new Set(input.channels)] }),
        ...(input.frequency && { frequency: input.frequency }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        // Bật lại sau thời gian tắt: không gửi dồn việc trong lúc tắt
        ...(input.enabled === true && !alert.enabled && { lastSentAt: new Date() }),
      },
    });
    return this.toItem(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const r = await this.prisma.jobAlert.deleteMany({ where: { id, userId } });
    if (!r.count) throw ApiException.notFound('Không tìm thấy thông báo việc làm');
  }

  /** "Xem chi tiết": việc khớp tiêu chí, mới nhất trước; đánh dấu đã xem */
  async jobs(userId: string, id: string, query: PaginationQuery): Promise<Paginated<JobListItem> & { newSince: string }> {
    const alert = await this.own(userId, id);
    const where = criteriaWhere(parseCriteria(alert.criteria));
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({ where, include: jobInclude, orderBy: { publishedAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.job.count({ where }),
    ]);
    await this.prisma.jobAlert.update({ where: { id: alert.id }, data: { lastSeenAt: new Date() } });
    const items = await this.jobsService.withSaved(rows.map((r) => this.mapper.listItem(r)), userId);
    return { ...paginated(items, total, query), newSince: alert.lastSeenAt.toISOString() };
  }

  async markSeen(userId: string, id: string): Promise<void> {
    const r = await this.prisma.jobAlert.updateMany({ where: { id, userId }, data: { lastSeenAt: new Date() } });
    if (!r.count) throw ApiException.notFound('Không tìm thấy thông báo việc làm');
  }

  private async matchProfile(userId: string) {
    const p = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    return {
      birthYear: p?.birthYear ?? null,
      gender: (p?.gender ?? null) as Gender | null,
      programs: p?.programs ?? [],
      industries: p?.industries ?? [],
      prefs: p?.prefs ?? [],
    };
  }

  /** "Việc mới cho bạn": việc khớp các thông báo đang bật trong 14 ngày, kèm % phù hợp với hồ sơ */
  async feed(userId: string, limit = 8): Promise<AlertFeedItem[]> {
    const alerts = await this.prisma.jobAlert.findMany({ where: { userId, enabled: true }, select: { criteria: true } });
    if (!alerts.length) return [];
    const since = new Date(Date.now() - 14 * DAY);
    const rows = await this.prisma.job.findMany({
      where: { OR: alerts.map((a) => criteriaWhere(parseCriteria(a.criteria), since)) },
      include: jobInclude,
      orderBy: { publishedAt: 'desc' },
      take: 60,
    });
    const profile = await this.matchProfile(userId);
    const scored = rows
      .map((row) => ({ row, score: matchJob(profile, row).score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const items = await this.jobsService.withSaved(scored.map(({ row, score }) => ({ ...this.mapper.listItem(row), matchScore: score })), userId);
    return items;
  }

  /**
   * Gợi ý tạo thông báo từ hồ sơ: ngành + tỉnh mong muốn + giới tính, kèm số việc khớp trong 7 ngày.
   * Bỏ gợi ý trùng tiêu chí thông báo đã có.
   */
  async suggestions(userId: string): Promise<JobAlertSuggestion[]> {
    const [p, existing] = await Promise.all([
      this.prisma.seekerProfile.findUnique({ where: { userId }, select: { industries: true, prefs: true, programs: true, gender: true } }),
      this.prisma.jobAlert.findMany({ where: { userId }, select: { criteria: true } }),
    ]);
    if (!p) return [];
    const taken = new Set(existing.map((a) => JSON.stringify(parseCriteria(a.criteria))));
    const candidates: Array<{ criteria: JobAlertCriteria; reason: string }> = [];
    const base = parseCriteria({});
    for (const industry of p.industries.slice(0, 2)) {
      candidates.push({
        criteria: { ...base, industries: [industry] as JobAlertCriteria['industries'], prefs: p.prefs.slice(0, 1), gender: p.gender ?? null },
        reason: 'Khớp ngành và tỉnh mong muốn trong hồ sơ của bạn',
      });
    }
    if (p.programs.length && p.prefs.length) {
      candidates.push({ criteria: { ...base, programs: p.programs.slice(0, 1), prefs: p.prefs.slice(0, 3) }, reason: 'Khớp chương trình và các tỉnh bạn quan tâm' });
    }

    const weekAgo = new Date(Date.now() - 7 * DAY);
    const out: JobAlertSuggestion[] = [];
    for (const c of candidates) {
      const parsed = parseCriteria(c.criteria);
      if (taken.has(JSON.stringify(parsed))) continue;
      const weeklyCount = await this.prisma.job.count({ where: criteriaWhere(parsed, weekAgo) });
      if (weeklyCount > 0) out.push({ name: defaultAlertName(parsed), criteria: parsed, weeklyCount, reason: c.reason });
    }
    return out.sort((a, b) => b.weeklyCount - a.weeklyCount).slice(0, 2);
  }
}
