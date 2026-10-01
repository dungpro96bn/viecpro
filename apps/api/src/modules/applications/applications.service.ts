import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { WEB_LINKS, type ApplicationItem, type ApplyInput } from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { ENV, type Env } from '../../config/env.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { EmailSender } from '../../core/mail/email-sender.js';
import { applicationReceivedEmail } from '../../core/mail/templates/apply.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ApplyEmailOtpService, maskEmail } from './apply-email-otp.service.js';

const applicationInclude = {
  job: { select: { id: true, slug: true, title: true, imageUrl: true, salary: true, pref: true, program: true, employer: { select: { name: true } } } },
  assignee: { select: { name: true, title: true, photoUrl: true } },
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ApplicationInclude;

type ApplicationRow = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly notifications: NotificationsService,
    private readonly emailOtp: ApplyEmailOtpService,
    private readonly mail: EmailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private toItem(a: ApplicationRow): ApplicationItem {
    const { employer, ...job } = a.job;
    return {
      id: a.id,
      status: a.status,
      interviewAt: a.interviewAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      job: { ...job, imageUrl: this.assets.url(job.imageUrl), employerName: employer?.name ?? null },
      timeline: a.events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt.toISOString() })),
    };
  }

  /** Ứng tuyển nhanh – khách (chưa đăng nhập) hoặc người tìm việc đã đăng nhập */
  async apply(input: ApplyInput, userId?: string): Promise<ApplicationItem> {
    const job = await this.prisma.job.findFirst({
      where: { OR: [...(input.jobId ? [{ id: input.jobId }] : []), ...(input.jobSlug ? [{ slug: input.jobSlug }] : [])] },
      include: { recruiter: { select: { userId: true } } },
    });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');
    if (job.status !== 'open') throw new ApiException('JOB_CLOSED', 'Đơn hàng đã ngừng tuyển', HttpStatus.CONFLICT);

    const duplicate = await this.prisma.application.findFirst({
      where: { jobId: job.id, status: { not: 'withdrawn' }, OR: [{ phone: input.phone }, ...(userId ? [{ userId }] : [])] },
      select: { id: true },
    });
    if (duplicate) throw new ApiException('ALREADY_APPLIED', 'Bạn đã ứng tuyển đơn này, cán bộ sẽ sớm liên hệ', HttpStatus.CONFLICT);

    // Email ứng tuyển phải xác nhận bằng mã OTP gửi tới chính email đó (trừ tài khoản đã xác thực email này)
    if (!(await this.emailOtp.isVerifiedFor(userId, input.email))) await this.emailOtp.verify(input.email, input.emailCode);
    const now = new Date();

    const created = await this.prisma.application.create({
      data: {
        jobId: job.id,
        userId,
        // Cán bộ đăng đơn phụ trách hồ sơ (ứng viên thấy tên trong email xác nhận và trang Việc đã ứng tuyển)
        assigneeId: job.recruiterId,
        emailVerifiedAt: now,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        birthYear: input.birthYear,
        gender: input.gender,
        address: input.address,
        note: input.note,
        events: { create: { status: 'submitted' } },
      },
      include: applicationInclude,
    });

    if (job.recruiter.userId) {
      await this.notifications.notify(job.recruiter.userId, 'application.new', {
        title: `Hồ sơ mới: ${input.fullName}`,
        body: job.title,
        link: `${WEB_LINKS.employerApplicants}?job=${job.id}&id=${created.id}`,
      });
    }
    if (userId) await this.markEmailVerified(userId, input.email, now);
    await this.sendReceived(created, !!userId);
    return this.toItem(created);
  }

  /** Tài khoản chưa có email → gắn email vừa xác thực; trùng email tài khoản → đánh dấu đã xác thực */
  private async markEmailVerified(userId: string, email: string, at: Date) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email === email) {
      await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: at } });
    } else if (!user?.email && !(await this.prisma.user.findFirst({ where: { email }, select: { id: true } }))) {
      await this.prisma.user.update({ where: { id: userId }, data: { email, emailVerifiedAt: at } });
    }
  }

  /** Email "Đã nhận hồ sơ" – lỗi gửi không làm hỏng việc ứng tuyển (RULE-BE.md mục 11) */
  private async sendReceived(a: ApplicationRow, hasAccount: boolean) {
    if (!a.email) return;
    try {
      const message = applicationReceivedEmail({
        to: a.email,
        fullName: a.fullName,
        code: `VP-${a.number}`,
        job: { slug: a.job.slug, title: a.job.title, pref: a.job.pref, salary: a.job.salary, imageUrl: this.assets.url(a.job.imageUrl), employerName: a.job.employer?.name },
        consultant: a.assignee && { ...a.assignee, photoUrl: this.assets.url(a.assignee.photoUrl) },
        hasAccount,
        webBaseUrl: this.env.WEB_BASE_URL,
        trackPath: WEB_LINKS.seekerApplications,
      });
      await this.mail.send({ to: a.email, ...message });
    } catch (e) {
      this.logger.error(`Gửi email xác nhận hồ sơ VP-${a.number} tới ${maskEmail(a.email)} thất bại: ${(e as Error).message}`);
    }
  }

  async withdraw(userId: string, id: string): Promise<ApplicationItem> {
    const app = await this.prisma.application.findFirst({ where: { id, userId } });
    if (!app) throw ApiException.notFound('Không tìm thấy hồ sơ ứng tuyển');
    if (['passed', 'rejected', 'withdrawn'].includes(app.status)) {
      throw new ApiException('CONFLICT', 'Hồ sơ này không thể rút nữa', HttpStatus.CONFLICT);
    }
    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: 'withdrawn', events: { create: { status: 'withdrawn' } } },
      include: applicationInclude,
    });
    return this.toItem(updated);
  }
}
