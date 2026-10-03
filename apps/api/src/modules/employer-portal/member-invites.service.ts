import { HttpStatus, Injectable } from '@nestjs/common';
import { maskVnPhone, type AcceptInviteInput, type MemberInvitePreview, type OtpSentResponse } from '@viecpro/shared';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { uniqueSlug } from '../../core/utils/unique-slug.js';
import { OtpService } from '../auth/otp.service.js';
import { hashPassword } from '../auth/password.js';
import { hashInviteToken, isInviteTokenShape } from './member-invite-token.js';

/**
 * Nhận lời mời thành viên (công khai, theo token trong link):
 * xem lời mời → gửi OTP tới đúng số được mời → nhập OTP + đặt mật khẩu → tạo tài khoản NTD trong doanh nghiệp.
 * Tài khoản chỉ được tạo sau khi chứng minh sở hữu số điện thoại – không tạo trước lúc mời.
 */
@Injectable()
export class MemberInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly assets: AssetUrlService,
  ) {}

  async preview(token: string): Promise<MemberInvitePreview> {
    const invite = await this.open(token);
    return {
      companyName: invite.employer.name,
      companyLogoUrl: this.assets.url(invite.employer.logoUrl),
      inviterName: invite.invitedBy.name,
      name: invite.name,
      title: invite.title,
      phoneMasked: maskVnPhone(invite.phone),
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async sendOtp(token: string): Promise<OtpSentResponse> {
    const invite = await this.open(token);
    const sent = await this.otp.send(invite.phone, 'join_company');
    // Không trả số đầy đủ cho người cầm link
    return { ...sent, phone: maskVnPhone(invite.phone) };
  }

  async accept(token: string, input: AcceptInviteInput): Promise<{ phone: string }> {
    const invite = await this.open(token);
    await this.otp.verify(invite.phone, 'join_company', input.code);
    const taken = await this.prisma.user.findFirst({ where: { phone: invite.phone, deletedAt: null }, select: { id: true } });
    if (taken) throw new ApiException('PHONE_TAKEN', 'Số điện thoại này đã có tài khoản viecpro – liên hệ người mời để dùng số khác', HttpStatus.CONFLICT);
    const emailFree = invite.email ? !(await this.prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })) : false;
    const passwordHash = await hashPassword(input.password);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Khoá lời mời trước: hai lần bấm cùng lúc chỉ một lần tạo được tài khoản
      const claimed = await tx.memberInvite.updateMany({ where: { id: invite.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: now } });
      if (!claimed.count) throw invalidInvite();
      const user = await tx.user.create({
        data: { role: 'employer', name: invite.name, phone: invite.phone, phoneVerifiedAt: now, passwordHash, ...(emailFree && { email: invite.email }) },
      });
      await tx.recruiter.create({
        data: {
          userId: user.id,
          employerId: invite.employerId,
          companyAdmin: invite.companyAdmin,
          name: invite.name,
          title: invite.title,
          phone: invite.phone,
          slug: await uniqueSlug(invite.name, async (s) => !!(await tx.recruiter.findUnique({ where: { slug: s }, select: { id: true } }))),
        },
      });
    });
    return { phone: invite.phone };
  }

  /** Lời mời còn hiệu lực; mọi trường hợp không hợp lệ trả cùng một lỗi 404 (không lộ lời mời có tồn tại) */
  private async open(token: string) {
    if (!isInviteTokenShape(token)) throw invalidInvite();
    const invite = await this.prisma.memberInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        title: true,
        companyAdmin: true,
        employerId: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        invitedBy: { select: { name: true, leftAt: true } },
        employer: { select: { name: true, logoUrl: true, suspendedAt: true } },
      },
    });
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date() || invite.employer.suspendedAt || invite.invitedBy.leftAt) throw invalidInvite();
    return invite;
  }
}

const invalidInvite = () => ApiException.notFound('Lời mời không còn hiệu lực – nhờ người mời gửi lại');
