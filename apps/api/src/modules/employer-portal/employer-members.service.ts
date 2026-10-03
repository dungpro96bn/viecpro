import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  COMPANY_MEMBER_LIMIT,
  maskPhoneTail,
  type CompanyMember,
  type CompanyMemberInvite,
  type CompanyMembers,
  type InviteMemberInput,
  type MemberInviteSent,
  type MemberRoleInput,
  type RemoveMemberInput,
} from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { EmailSender } from '../../core/mail/email-sender.js';
import { memberInviteEmail } from '../../core/mail/templates/account.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { SmsSender } from '../notifications/sms-sender.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';
import { INVITE_TTL_DAYS, inviteLink, newInviteToken } from './member-invite-token.js';

/** Tin chưa đóng của thành viên bị gỡ được chuyển cho người nhận bàn giao */
const OPEN_JOB_STATUSES = ['draft', 'pending', 'open', 'paused', 'rejected'] as const;
const ACTIVE_APPLICATION_STATUSES = ['submitted', 'viewed', 'interview', 'passed'] as const;

/**
 * Thành viên doanh nghiệp: xem danh sách (mọi thành viên), mời / đổi quyền / gỡ (quản trị viên doanh nghiệp).
 * Phạm vi luôn là doanh nghiệp của người thao tác – id thành viên ngoài doanh nghiệp trả 404 (RULE-BE.md mục 6 lớp 2).
 */
@Injectable()
export class EmployerMembersService {
  private readonly logger = new Logger(EmployerMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
    private readonly sms: SmsSender,
    private readonly mail: EmailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(userId: string): Promise<CompanyMembers> {
    const { actor, admin } = await this.company(userId);
    const employerId = actor.employerId!;
    const [rows, invites] = await Promise.all([
      this.prisma.recruiter.findMany({
        where: { employerId, leftAt: null },
        orderBy: [{ companyAdmin: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          title: true,
          photoUrl: true,
          phone: true,
          companyAdmin: true,
          user: { select: { id: true, phone: true, email: true, lastLoginAt: true } },
          _count: {
            select: {
              jobs: { where: { employerId, status: 'open' } },
              assigned: { where: { status: { in: [...ACTIVE_APPLICATION_STATUSES] } } },
            },
          },
        },
      }),
      admin ? this.pendingInvites(employerId) : Promise.resolve([]),
    ]);
    const members: CompanyMember[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      title: r.title,
      photoUrl: this.assets.url(r.photoUrl),
      phone: r.user?.phone ?? r.phone,
      email: r.user?.email ?? null,
      companyAdmin: r.companyAdmin,
      hasAccount: !!r.user,
      isSelf: r.id === actor.recruiterId,
      lastLoginAt: r.user?.lastLoginAt?.toISOString() ?? null,
      openJobs: r._count.jobs,
      activeApplicants: r._count.assigned,
    }));
    return { canManage: admin, limit: COMPANY_MEMBER_LIMIT, members, invites };
  }

  async invite(userId: string, input: InviteMemberInput): Promise<MemberInviteSent> {
    const { actor } = await this.company(userId, true);
    const employerId = actor.employerId!;
    const [members, pending, taken, duplicate] = await Promise.all([
      this.prisma.recruiter.count({ where: { employerId, leftAt: null } }),
      this.prisma.memberInvite.count({ where: { employerId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.user.findFirst({ where: { phone: input.phone, deletedAt: null }, select: { id: true } }),
      this.prisma.memberInvite.findFirst({ where: { employerId, phone: input.phone, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }),
    ]);
    if (members + pending >= COMPANY_MEMBER_LIMIT) {
      throw new ApiException('CONFLICT', `Doanh nghiệp đã đủ ${COMPANY_MEMBER_LIMIT} thành viên (kể cả lời mời đang chờ)`, HttpStatus.CONFLICT);
    }
    // Chỉ mời số chưa có tài khoản: không tự gộp tài khoản ứng viên / NTD khác vào doanh nghiệp
    if (taken) {
      throw new ApiException('PHONE_TAKEN', 'Số điện thoại này đã có tài khoản viecpro – dùng số khác hoặc liên hệ hỗ trợ', HttpStatus.CONFLICT, { phone: 'Số đã có tài khoản viecpro' });
    }
    if (duplicate) throw new ApiException('CONFLICT', 'Số này đang có lời mời chưa nhận – dùng “Gửi lại” trong danh sách lời mời', HttpStatus.CONFLICT, { phone: 'Đã có lời mời đang chờ' });

    const { token, tokenHash, expiresAt } = newInviteToken();
    const created = await this.prisma.memberInvite.create({
      data: { employerId, invitedById: actor.recruiterId, name: input.name, phone: input.phone, email: input.email, title: input.title, companyAdmin: input.companyAdmin, tokenHash, expiresAt },
      select: inviteSelect,
    });
    await this.deliver(created, token);
    return { invite: toInvite(created), ...this.devLink(token) };
  }

  /** Gửi lại: cấp link mới (link cũ hết hiệu lực), gia hạn 7 ngày */
  async resend(userId: string, inviteId: string): Promise<MemberInviteSent> {
    const { actor } = await this.company(userId, true);
    const current = await this.prisma.memberInvite.findFirst({ where: { id: inviteId, employerId: actor.employerId!, acceptedAt: null, revokedAt: null }, select: { id: true } });
    if (!current) throw ApiException.notFound('Không tìm thấy lời mời');
    const { token, tokenHash, expiresAt } = newInviteToken();
    const updated = await this.prisma.memberInvite.update({ where: { id: current.id }, data: { tokenHash, expiresAt }, select: inviteSelect });
    await this.deliver(updated, token);
    return { invite: toInvite(updated), ...this.devLink(token) };
  }

  async revoke(userId: string, inviteId: string): Promise<void> {
    const { actor } = await this.company(userId, true);
    const { count } = await this.prisma.memberInvite.updateMany({ where: { id: inviteId, employerId: actor.employerId!, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!count) throw ApiException.notFound('Không tìm thấy lời mời');
  }

  async setRole(userId: string, memberId: string, input: MemberRoleInput): Promise<CompanyMembers> {
    const { actor } = await this.company(userId, true);
    if (memberId === actor.recruiterId) throw ApiException.forbidden('Không thể tự đổi quyền của chính mình');
    const member = await this.member(actor, memberId);
    if (!member.userId) throw new ApiException('VALIDATION_ERROR', 'Thành viên chưa có tài khoản đăng nhập', HttpStatus.BAD_REQUEST);
    await this.prisma.recruiter.update({ where: { id: memberId }, data: { companyAdmin: input.companyAdmin } });
    return this.list(userId);
  }

  /** Xoá mềm thành viên (vào Thùng rác): chặn vào khu quản lý, đăng xuất mọi thiết bị, bàn giao tin đang mở / hồ sơ / lịch hẹn sắp tới */
  async remove(userId: string, memberId: string, input: RemoveMemberInput): Promise<CompanyMembers> {
    const { actor } = await this.company(userId, true);
    if (memberId === actor.recruiterId) throw ApiException.forbidden('Không thể tự gỡ chính mình khỏi doanh nghiệp');
    const member = await this.member(actor, memberId);
    const targetId = input.transferToId ?? actor.recruiterId;
    if (targetId === memberId) throw new ApiException('VALIDATION_ERROR', 'Chọn người nhận bàn giao khác', HttpStatus.BAD_REQUEST, { transferToId: 'Chọn người khác' });
    const target = await this.member(actor, targetId);
    if (!target.userId) throw new ApiException('VALIDATION_ERROR', 'Người nhận bàn giao phải có tài khoản đăng nhập', HttpStatus.BAD_REQUEST, { transferToId: 'Chọn người có tài khoản' });

    const employerId = actor.employerId!;
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.job.updateMany({ where: { employerId, recruiterId: memberId, status: { in: [...OPEN_JOB_STATUSES] } }, data: { recruiterId: target.id } }),
      this.prisma.application.updateMany({ where: { assigneeId: memberId, job: { employerId }, status: { in: [...ACTIVE_APPLICATION_STATUSES] } }, data: { assigneeId: target.id } }),
      this.prisma.interview.updateMany({ where: { employerId, ownerId: memberId, status: 'scheduled', startAt: { gte: now } }, data: { ownerId: target.id } }),
      this.prisma.recruiter.update({ where: { id: memberId }, data: { leftAt: now, removedById: actor.recruiterId, companyAdmin: false } }),
      ...(member.userId ? [this.prisma.session.updateMany({ where: { userId: member.userId, revokedAt: null }, data: { revokedAt: now } })] : []),
    ]);
    return this.list(userId);
  }

  /** Người thao tác phải thuộc doanh nghiệp; `requireAdmin` = chỉ quản trị viên doanh nghiệp */
  private async company(userId: string, requireAdmin = false) {
    const actor = await this.ctx.resolve(userId);
    if (!actor.employerId) throw ApiException.notFound('Tài khoản không thuộc doanh nghiệp nào');
    const me = await this.prisma.recruiter.findUniqueOrThrow({ where: { id: actor.recruiterId }, select: { companyAdmin: true } });
    if (requireAdmin && !me.companyAdmin) throw ApiException.forbidden('Chỉ quản trị viên doanh nghiệp được quản lý thành viên');
    return { actor, admin: me.companyAdmin };
  }

  private async member(actor: EmployerActor, id: string) {
    const m = await this.prisma.recruiter.findFirst({ where: { id, employerId: actor.employerId!, leftAt: null }, select: { id: true, userId: true } });
    if (!m) throw ApiException.notFound('Không tìm thấy thành viên');
    return m;
  }

  private async pendingInvites(employerId: string): Promise<CompanyMemberInvite[]> {
    const rows = await this.prisma.memberInvite.findMany({ where: { employerId, acceptedAt: null, revokedAt: null }, orderBy: { createdAt: 'desc' }, take: COMPANY_MEMBER_LIMIT, select: inviteSelect });
    return rows.map(toInvite);
  }

  /** SMS tới số được mời (+ email nếu có). Lỗi dịch vụ ngoài không làm hỏng lời mời – người mời có thể gửi lại */
  private async deliver(invite: InviteRow, token: string) {
    const link = inviteLink(this.env.WEB_BASE_URL, token);
    const company = invite.employer.shortName ?? invite.employer.name;
    await this.sms
      .send(invite.phone, `${company} moi ban tham gia viecpro Business. Nhan loi moi (7 ngay): ${link}`)
      .catch((e: unknown) => this.logger.warn(`Gửi SMS lời mời tới ${maskPhoneTail(invite.phone)} lỗi: ${String(e)}`));
    if (invite.email) {
      const message = memberInviteEmail({ to: invite.email, name: invite.name, companyName: company, inviterName: invite.invitedBy.name, title: invite.title, acceptUrl: link, expiresDays: INVITE_TTL_DAYS, webBaseUrl: this.env.WEB_BASE_URL });
      await this.mail.send({ to: invite.email, ...message }).catch((e: unknown) => this.logger.warn(`Gửi email lời mời lỗi: ${String(e)}`));
    }
  }

  private devLink(token: string) {
    return this.env.NODE_ENV === 'production' ? {} : { devLink: inviteLink(this.env.WEB_BASE_URL, token) };
  }
}

const inviteSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  title: true,
  companyAdmin: true,
  createdAt: true,
  expiresAt: true,
  invitedBy: { select: { name: true } },
  employer: { select: { name: true, shortName: true } },
} as const;
type InviteRow = { id: string; name: string; phone: string; email: string | null; title: string; companyAdmin: boolean; createdAt: Date; expiresAt: Date; invitedBy: { name: string }; employer: { name: string; shortName: string | null } };

function toInvite(r: InviteRow): CompanyMemberInvite {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    title: r.title,
    companyAdmin: r.companyAdmin,
    invitedBy: r.invitedBy.name,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    expired: r.expiresAt.getTime() < Date.now(),
  };
}
