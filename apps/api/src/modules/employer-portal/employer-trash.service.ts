import { HttpStatus, Injectable } from '@nestjs/common';
import {
  COMPANY_MEMBER_LIMIT,
  confirmTextMatches,
  TRASH_CATEGORIES,
  type Paginated,
  type PurgeInput,
  type TrashedJob,
  type TrashedMember,
  type TrashListQuery,
  type TrashSummary,
} from '@viecpro/shared';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';
import { EmployerJobTrashService } from './employer-job-trash.service.js';
import { trashPurgeAt } from './trash-retention.js';

/** Tên thay thế sau khi xoá vĩnh viễn – lịch sử (tin đã đóng, ghi chú) vẫn giữ nhưng không còn dữ liệu cá nhân */
export const PURGED_MEMBER_NAME = 'Thành viên đã xoá';

/**
 * Thùng rác khu NTD (quản trị viên doanh nghiệp hoặc NTD cá nhân): tin đã xoá (Job.deletedAt), thành viên đã xoá (Recruiter.leftAt).
 * Xoá vĩnh viễn = ẩn danh hồ sơ + tài khoản, không xoá bản ghi (RULE-BE.md mục 8, 10 – không xoá cứng người dùng,
 * và xoá thật sẽ cascade mất lịch hẹn / ghi chú đã có).
 */
@Injectable()
export class EmployerTrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
    private readonly jobTrash: EmployerJobTrashService,
  ) {}

  /** NTD cá nhân: thùng rác chỉ có tin của mình. Doanh nghiệp: tin + thành viên */
  async summary(userId: string): Promise<TrashSummary> {
    const actor = await this.owner(userId);
    const counts: Record<(typeof TRASH_CATEGORIES)[number]['key'], number> = {
      jobs: await this.jobTrash.count(actor),
      members: actor.employerId ? await this.prisma.recruiter.count({ where: trashedMembers(actor.employerId) }) : 0,
    };
    const categories = TRASH_CATEGORIES.filter((c) => actor.employerId || c.key !== 'members');
    return { categories: categories.map((c) => ({ key: c.key, label: c.label, count: counts[c.key] })) };
  }

  async jobs(userId: string, q: TrashListQuery): Promise<Paginated<TrashedJob>> {
    return this.jobTrash.list(await this.owner(userId), q);
  }

  async restoreJob(userId: string, id: string): Promise<void> {
    await this.jobTrash.restore(await this.owner(userId), id);
  }

  async purgeJob(userId: string, id: string, input: PurgeInput): Promise<void> {
    await this.jobTrash.purge(await this.owner(userId), id, input);
  }

  async members(userId: string, q: TrashListQuery): Promise<Paginated<TrashedMember>> {
    const employerId = await this.adminCompany(userId);
    const where = trashedMembers(employerId);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.recruiter.findMany({
        where,
        orderBy: { leftAt: 'desc' },
        ...pageArgs(q),
        select: {
          id: true,
          name: true,
          title: true,
          photoUrl: true,
          phone: true,
          leftAt: true,
          removedBy: { select: { name: true } },
          user: { select: { phone: true, email: true } },
          _count: { select: { jobs: true, notes: true } },
        },
      }),
      this.prisma.recruiter.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        title: r.title,
        photoUrl: this.assets.url(r.photoUrl),
        phone: r.user?.phone ?? r.phone,
        email: r.user?.email ?? null,
        hasAccount: !!r.user,
        removedAt: r.leftAt!.toISOString(),
        removedBy: r.removedBy?.name ?? null,
        purgeAt: trashPurgeAt(r.leftAt!).toISOString(),
        keptJobs: r._count.jobs,
        keptNotes: r._count.notes,
        confirmText: r.name,
      })),
      total,
      q,
    );
  }

  /** Khôi phục: vào lại khu quản lý (đăng nhập lại), quyền thành viên thường; tin / hồ sơ đã bàn giao không tự trả lại */
  async restoreMember(userId: string, id: string): Promise<void> {
    const employerId = await this.adminCompany(userId);
    const member = await this.trashedMember(employerId, id);
    if (member.user?.deletedAt) throw new ApiException('CONFLICT', 'Tài khoản của thành viên này đã bị xoá, không khôi phục được', HttpStatus.CONFLICT);
    const [active, pending] = await Promise.all([
      this.prisma.recruiter.count({ where: { employerId, leftAt: null } }),
      this.prisma.memberInvite.count({ where: { employerId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    if (active + pending >= COMPANY_MEMBER_LIMIT) {
      throw new ApiException('CONFLICT', `Doanh nghiệp đã đủ ${COMPANY_MEMBER_LIMIT} thành viên (kể cả lời mời đang chờ)`, HttpStatus.CONFLICT);
    }
    const { count } = await this.prisma.recruiter.updateMany({ where: { id, ...trashedMembers(employerId) }, data: { leftAt: null, removedById: null } });
    if (!count) throw ApiException.notFound('Không tìm thấy thành viên trong thùng rác');
  }

  /** Xoá vĩnh viễn: phải gõ đúng 100% tên thành viên (cả hoa / thường). Ẩn danh hồ sơ + vô hiệu tài khoản, giải phóng số điện thoại để mời lại */
  async purgeMember(userId: string, id: string, input: PurgeInput): Promise<void> {
    const employerId = await this.adminCompany(userId);
    const member = await this.trashedMember(employerId, id);
    if (!confirmTextMatches(input.confirm, member.name)) {
      throw new ApiException('VALIDATION_ERROR', 'Tên nhập lại không khớp – chưa xoá', HttpStatus.BAD_REQUEST, { confirm: `Gõ đúng: ${member.name}` });
    }
    const purged = await purgeTrashedMember(this.prisma, { id, userId: member.userId }, trashedMembers(employerId));
    if (!purged) throw ApiException.notFound('Không tìm thấy thành viên trong thùng rác');
  }

  /** Người mở được Thùng rác: NTD cá nhân (dữ liệu của mình) hoặc quản trị viên doanh nghiệp */
  private async owner(userId: string): Promise<EmployerActor> {
    const actor = await this.ctx.resolve(userId);
    if (!actor.employerId) return actor;
    const me = await this.prisma.recruiter.findUniqueOrThrow({ where: { id: actor.recruiterId }, select: { companyAdmin: true } });
    if (!me.companyAdmin) throw ApiException.forbidden('Chỉ quản trị viên doanh nghiệp được mở Thùng rác');
    return actor;
  }

  /** Thành viên đã xoá chỉ có ở doanh nghiệp; NTD cá nhân → 404 */
  private async adminCompany(userId: string): Promise<string> {
    const actor = await this.owner(userId);
    if (!actor.employerId) throw ApiException.notFound('Tài khoản không thuộc doanh nghiệp nào');
    return actor.employerId;
  }

  private async trashedMember(employerId: string, id: string) {
    const m = await this.prisma.recruiter.findFirst({ where: { id, ...trashedMembers(employerId) }, select: { id: true, name: true, userId: true, user: { select: { deletedAt: true } } } });
    if (!m) throw ApiException.notFound('Không tìm thấy thành viên trong thùng rác');
    return m;
  }
}

/** Thành viên đã xoá mềm của doanh nghiệp, chưa xoá vĩnh viễn */
export const trashedMembers = (employerId: string): Prisma.RecruiterWhereInput => ({ employerId, leftAt: { not: null }, purgedAt: null });

/**
 * Xoá vĩnh viễn một thành viên: ẩn danh hồ sơ + vô hiệu tài khoản, giải phóng số điện thoại.
 * Khoá bằng cập nhật có điều kiện (`purgedAt: null` + `scope`) nên chạy trùng (tay / tự động / nhiều instance) chỉ xoá một lần.
 * Trả false nếu bản ghi không còn khớp `scope` (đã khôi phục hoặc đã xoá).
 */
export async function purgeTrashedMember(
  prisma: PrismaService,
  member: { id: string; userId: string | null },
  scope: Prisma.RecruiterWhereInput,
  now = new Date(),
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.recruiter.updateMany({
      where: { ...scope, id: member.id, purgedAt: null },
      data: { purgedAt: now, name: PURGED_MEMBER_NAME, title: '', phone: null, photoUrl: null, headline: null, intro: null, city: null, sections: {}, online: false },
    });
    if (!count) return false;
    await tx.follow.deleteMany({ where: { recruiterId: member.id } });
    if (member.userId) {
      await tx.user.update({
        where: { id: member.userId },
        data: { deletedAt: now, phone: null, email: null, googleId: null, passwordHash: null, name: 'Tài khoản đã xoá', avatarUrl: null },
      });
      await tx.session.updateMany({ where: { userId: member.userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.pushToken.deleteMany({ where: { userId: member.userId } });
    }
    return true;
  });
}
