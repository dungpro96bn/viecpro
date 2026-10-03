import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  homepageContentSchema,
  jobDetailContentSchema,
  REGION_OF_PREF,
  systemSettingsSchema,
  type AdminExportInput,
  type AdminJobUpdateInput,
  type AdminManageJobsQuery,
  type HomepageContent,
  type SystemSettings,
} from '@viecpro/shared';
import type { Request } from 'express';
import { AuditService } from '../../core/audit/audit.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { jobSearchText } from '../jobs/job-query.js';
import type { AdminContext } from './admin-access.js';

const EXPORT_LIMIT = 10_000;
const EXPORT_TTL_MS = 15 * 60_000;

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  supportPhone: '19006688',
  supportEmail: 'hotro@viecpro.vn',
  maintenanceMode: false,
  maintenanceMessage: 'ViecPro đang bảo trì. Vui lòng quay lại sau.',
};

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  employerBanner: {
    enabled: false,
    image: '/images/ads/employer-ad.jpg',
    tag: '',
    title: 'Banner nhà tuyển dụng',
    description: '',
    cta: '',
    href: '/',
  },
  courseBanner: {
    enabled: false,
    image: '/images/ads/japanese-course.jpg',
    tag: '',
    title: 'Banner khóa học',
    description: '',
    cta: '',
    href: '/',
  },
  miniAdsTitle: 'Quảng cáo dịch vụ',
  miniAds: [],
};

type Dataset = AdminExportInput['dataset'];

function csvCell(value: unknown): string {
  let text = value instanceof Date ? value.toISOString() : value == null ? '' : String(value as string | number | boolean);
  // Chặn chèn công thức khi mở CSV bằng Excel / Sheets
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '\uFEFF';
  const columns = Object.keys(rows[0]!);
  return `\uFEFF${[columns.map(csvCell).join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\r\n')}`;
}

@Injectable()
export class AdminToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async jobs(query: AdminManageJobsQuery) {
    const where: Prisma.JobWhereInput = query.q
      ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: { id: true, code: true, title: true, status: true, employer: { select: { name: true, shortName: true } }, recruiter: { select: { name: true } }, updatedAt: true },
      }),
    ]);
    return {
      items: items.map((job) => ({ id: job.id, code: job.code, title: job.title, status: job.status, employer: job.employer?.shortName ?? job.employer?.name ?? job.recruiter.name, updatedAt: job.updatedAt.toISOString() })),
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    };
  }

  async job(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: { id: true, code: true, title: true, industry: true, pref: true, salary: true, quantity: true, detail: true, status: true, employer: { select: { name: true, shortName: true } }, recruiter: { select: { name: true } } },
    });
    if (!job) throw ApiException.notFound('Không tìm thấy tin tuyển dụng');
    const detail = jobDetailContentSchema.parse(job.detail ?? {});
    return {
      id: job.id,
      code: job.code,
      title: job.title,
      industry: job.industry,
      pref: job.pref,
      salary: job.salary,
      quantity: job.quantity,
      description: detail.overview || detail.posting?.description || '',
      status: job.status,
      employer: job.employer?.shortName ?? job.employer?.name ?? job.recruiter.name,
    };
  }

  async updateJob(admin: AdminContext, id: string, input: AdminJobUpdateInput, req: Request) {
    const current = await this.prisma.job.findUnique({ where: { id } });
    if (!current) throw ApiException.notFound('Không tìm thấy tin tuyển dụng');
    const detail = jobDetailContentSchema.parse(current.detail ?? {});
    const nextDetail = { ...detail, overview: input.description, ...(detail.posting ? { posting: { ...detail.posting, description: input.description } } : {}) };
    const before = { title: current.title, industry: current.industry, pref: current.pref, salary: current.salary, quantity: current.quantity, description: detail.overview || detail.posting?.description || '' };
    const after = { title: input.title, industry: input.industry, pref: input.pref, salary: input.salary, quantity: input.quantity, description: input.description };
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id },
        data: {
          title: input.title,
          industry: input.industry,
          pref: input.pref,
          region: REGION_OF_PREF[input.pref]!,
          salary: input.salary,
          quantity: input.quantity,
          detail: nextDetail as Prisma.InputJsonValue,
          searchText: jobSearchText({ title: input.title, pref: input.pref, industry: input.industry, code: current.code }),
        },
      });
      await this.audit.log({ actorId: admin.id, action: 'job.admin_update', targetType: 'job', targetId: id, before, after }, req, tx);
    });
    return this.job(id);
  }

  private async setting<T>(key: string, schema: { parse(value: unknown): T }, fallback: T): Promise<T> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
    if (!row) return fallback;
    const parsed = schema.parse(row.value);
    return parsed;
  }

  getSystemSettings() {
    return this.setting('system', systemSettingsSchema, DEFAULT_SYSTEM_SETTINGS);
  }

  getHomepageContent() {
    return this.setting('homepage', homepageContentSchema, DEFAULT_HOMEPAGE_CONTENT);
  }

  async updateSystemSettings(admin: AdminContext, input: SystemSettings, req: Request) {
    await this.updateSetting(admin, 'system', input, req);
    return input;
  }

  async updateHomepageContent(admin: AdminContext, input: HomepageContent, req: Request) {
    await this.updateSetting(admin, 'homepage', input, req);
    return input;
  }

  private async updateSetting(admin: AdminContext, key: string, value: object, req: Request) {
    const before = await this.prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: admin.id, updatedAt: new Date() },
        update: { value: value as Prisma.InputJsonValue, updatedById: admin.id, updatedAt: new Date() },
      });
      await this.audit.log({ actorId: admin.id, action: key === 'system' ? 'system.settings_update' : 'content.homepage_update', targetType: 'system_setting', targetId: key, before: before?.value ?? null, after: value }, req, tx);
    });
  }

  private requiresPii(admin: AdminContext, dataset: Dataset) {
    if ((dataset === 'users' || dataset === 'applications') && !admin.permissions.includes('users.pii')) {
      throw ApiException.forbidden('Xuất ứng viên hoặc tài khoản cần thêm quyền users.pii');
    }
  }

  private async countDataset(dataset: Dataset): Promise<number> {
    switch (dataset) {
      case 'jobs': return this.prisma.job.count();
      case 'employers': return this.prisma.employer.count();
      case 'applications': return this.prisma.application.count();
      case 'users': return this.prisma.user.count({ where: { role: { not: 'admin' }, deletedAt: null } });
    }
  }

  async createExport(admin: AdminContext, input: AdminExportInput, req: Request) {
    this.requiresPii(admin, input.dataset);
    const total = await this.countDataset(input.dataset);
    const rowCount = Math.min(total, EXPORT_LIMIT);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + EXPORT_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.adminExportToken.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), adminId: admin.id, dataset: input.dataset, rowCount, expiresAt } });
      await this.audit.log({ actorId: admin.id, action: 'data.export', targetType: input.dataset, after: { rows: rowCount, truncated: total > EXPORT_LIMIT, expiresAt: expiresAt.toISOString() } }, req, tx);
    });
    return { downloadPath: `/admin/exports/download/${token}`, rows: rowCount, truncated: total > EXPORT_LIMIT, expiresAt: expiresAt.toISOString() };
  }

  private async exportRows(tx: Prisma.TransactionClient, dataset: Dataset, limit: number): Promise<Array<Record<string, unknown>>> {
    switch (dataset) {
      case 'jobs': {
        const rows = await tx.job.findMany({ take: limit, orderBy: { createdAt: 'asc' }, select: { code: true, title: true, status: true, industry: true, pref: true, salary: true, quantity: true, createdAt: true, employer: { select: { name: true, shortName: true } }, recruiter: { select: { name: true } } } });
        return rows.map((r) => ({ code: r.code, title: r.title, status: r.status, industry: r.industry, prefecture: r.pref, salary: r.salary, quantity: r.quantity, employer: r.employer?.shortName ?? r.employer?.name ?? r.recruiter.name, createdAt: r.createdAt }));
      }
      case 'employers': {
        const rows = await tx.employer.findMany({ take: limit, orderBy: { createdAt: 'asc' }, select: { name: true, shortName: true, verified: true, city: true, createdAt: true } });
        return rows.map((r) => ({ name: r.name, shortName: r.shortName, verified: r.verified, city: r.city, createdAt: r.createdAt }));
      }
      case 'applications': {
        const rows = await tx.application.findMany({ take: limit, orderBy: { createdAt: 'asc' }, select: { fullName: true, phone: true, email: true, status: true, source: true, createdAt: true, job: { select: { code: true, title: true } } } });
        return rows.map((r) => ({ fullName: r.fullName, phone: r.phone, email: r.email, status: r.status, source: r.source, jobCode: r.job.code, jobTitle: r.job.title, createdAt: r.createdAt }));
      }
      case 'users': {
        const rows = await tx.user.findMany({ where: { role: { not: 'admin' }, deletedAt: null }, take: limit, orderBy: { createdAt: 'asc' }, select: { name: true, phone: true, email: true, role: true, createdAt: true } });
        return rows.map((r) => ({ name: r.name, phone: r.phone, email: r.email, role: r.role, createdAt: r.createdAt }));
      }
    }
  }

  async consumeExport(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    // Đánh dấu đã dùng bằng một câu lệnh nguyên tử – hai request cùng lúc chỉ một bên thắng
    const claimed = await this.prisma.adminExportToken.updateMany({ where: { tokenHash, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (claimed.count !== 1) throw ApiException.notFound('Liên kết tải không tồn tại, đã hết hạn hoặc đã được sử dụng');
    const record = await this.prisma.adminExportToken.findUniqueOrThrow({ where: { tokenHash }, select: { dataset: true, rowCount: true } });
    // Đọc tối đa 10.000 dòng ngoài transaction tương tác (tránh vượt timeout 5 giây mặc định)
    const rows = await this.exportRows(this.prisma, record.dataset as Dataset, Math.min(record.rowCount, EXPORT_LIMIT));
    return { csv: toCsv(rows), filename: `viecpro-${record.dataset}-${now.toISOString().slice(0, 10)}.csv` };
  }
}
