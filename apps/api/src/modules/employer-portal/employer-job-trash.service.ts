import { HttpStatus, Injectable } from '@nestjs/common';
import { confirmTextMatches, DELETABLE_JOB_STATUSES, type JobStatus, type Paginated, type PurgeInput, type TrashedJob, type TrashListQuery } from '@viecpro/shared';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';
import { trashPurgeAt } from './trash-retention.js';

/**
 * Tin tuyển dụng trong Thùng rác. Xoá = xoá mềm (Job.deletedAt), hồ sơ ứng tuyển giữ nguyên để NTD vẫn theo dõi.
 * Xoá vĩnh viễn giữ bản ghi (đánh dấu purgedAt) để ứng viên còn lịch sử ứng tuyển, chỉ mất trang tin.
 */
@Injectable()
export class EmployerJobTrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
  ) {}

  /** Chuyển tin vào Thùng rác – ai quản lý được tin (jobScope) thì xoá được */
  async remove(userId: string, jobId: string): Promise<void> {
    const actor = await this.ctx.resolve(userId);
    const job = await this.prisma.job.findFirst({ where: { id: jobId, ...this.ctx.jobScope(actor) }, select: { status: true } });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');
    if (!(DELETABLE_JOB_STATUSES as readonly string[]).includes(job.status)) {
      throw new ApiException('CONFLICT', 'Chỉ xoá được tin nháp, bị từ chối hoặc đã đóng. Hãy đóng tin trước khi xoá.', HttpStatus.CONFLICT);
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Điều kiện trạng thái nằm trong câu cập nhật: tin vừa được mở lại ở tab khác thì không bị xoá
      const { count } = await tx.job.updateMany({
        where: { id: jobId, ...this.ctx.jobScope(actor), status: { in: [...DELETABLE_JOB_STATUSES] } },
        data: { deletedAt: now, deletedById: actor.recruiterId },
      });
      if (!count) throw new ApiException('CONFLICT', 'Tin vừa đổi trạng thái, vui lòng tải lại trang', HttpStatus.CONFLICT);
      await tx.jobEvent.create({ data: { jobId, actorId: actor.recruiterId, action: 'delete' } });
    });
  }

  count(actor: EmployerActor): Promise<number> {
    return this.prisma.job.count({ where: trashedJobs(this.ctx.ownerScope(actor)) });
  }

  async list(actor: EmployerActor, q: TrashListQuery): Promise<Paginated<TrashedJob>> {
    const where = trashedJobs(this.ctx.ownerScope(actor));
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        ...pageArgs(q),
        select: { id: true, code: true, title: true, status: true, deletedAt: true, deletedBy: { select: { name: true } }, _count: { select: { applications: true } } },
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginated(
      rows.map((j) => ({
        id: j.id,
        code: j.code,
        title: j.title,
        status: j.status as JobStatus,
        removedAt: j.deletedAt!.toISOString(),
        removedBy: j.deletedBy?.name ?? null,
        purgeAt: trashPurgeAt(j.deletedAt!).toISOString(),
        applications: j._count.applications,
        confirmText: j.code,
      })),
      total,
      q,
    );
  }

  /** Khôi phục: tin trở lại đúng trạng thái lúc xoá (nháp / bị từ chối / đã đóng), không tự hiển thị công khai */
  async restore(actor: EmployerActor, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.job.updateMany({ where: { id, ...trashedJobs(this.ctx.ownerScope(actor)) }, data: { deletedAt: null, deletedById: null } });
      if (!count) throw ApiException.notFound('Không tìm thấy tin trong thùng rác');
      await tx.jobEvent.create({ data: { jobId: id, actorId: actor.recruiterId, action: 'restore' } });
    });
  }

  /** Xoá vĩnh viễn: phải gõ đúng mã tin */
  async purge(actor: EmployerActor, id: string, input: PurgeInput): Promise<void> {
    const scope = trashedJobs(this.ctx.ownerScope(actor));
    const job = await this.prisma.job.findFirst({ where: { id, ...scope }, select: { code: true } });
    if (!job) throw ApiException.notFound('Không tìm thấy tin trong thùng rác');
    if (!confirmTextMatches(input.confirm, job.code)) {
      throw new ApiException('VALIDATION_ERROR', 'Mã tin nhập lại không khớp – chưa xoá', HttpStatus.BAD_REQUEST, { confirm: `Gõ đúng: ${job.code}` });
    }
    if (!(await purgeTrashedJob(this.prisma, id, scope))) throw ApiException.notFound('Không tìm thấy tin trong thùng rác');
  }
}

/** Tin đã xoá mềm, chưa xoá vĩnh viễn, trong phạm vi chủ sở hữu */
export const trashedJobs = (owner: Prisma.JobWhereInput): Prisma.JobWhereInput => ({ ...owner, deletedAt: { not: null }, purgedAt: null });

/**
 * Xoá vĩnh viễn một tin: đánh dấu purgedAt (không khôi phục được), bỏ khỏi danh sách đã lưu của ứng viên.
 * Bản ghi + hồ sơ ứng tuyển được giữ (ứng viên vẫn thấy "Tin đã bị gỡ"). Khoá có điều kiện nên chạy trùng chỉ xoá một lần.
 */
export async function purgeTrashedJob(prisma: PrismaService, id: string, scope: Prisma.JobWhereInput, now = new Date()): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.job.updateMany({ where: { ...scope, id, purgedAt: null }, data: { purgedAt: now } });
    if (!count) return false;
    await tx.savedJob.deleteMany({ where: { jobId: id } });
    return true;
  });
}
