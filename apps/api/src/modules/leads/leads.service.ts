import { Injectable } from '@nestjs/common';
import { normalizeVnPhone, WEB_LINKS, type ConsultInput, type SubscribeInput } from '@viecpro/shared';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async consult(input: ConsultInput): Promise<void> {
    const [employer, recruiter, job] = await Promise.all([
      input.employerSlug ? this.prisma.employer.findUnique({ where: { slug: input.employerSlug }, select: { id: true } }) : null,
      input.recruiterSlug ? this.prisma.recruiter.findUnique({ where: { slug: input.recruiterSlug }, select: { id: true, userId: true } }) : null,
      input.jobId ? this.prisma.job.findFirst({ where: { OR: [{ id: input.jobId }, { slug: input.jobId }] }, select: { id: true } }) : null,
    ]);
    if (input.employerSlug && !employer) throw ApiException.notFound('Không tìm thấy nhà tuyển dụng');
    if (input.recruiterSlug && !recruiter) throw ApiException.notFound('Không tìm thấy tư vấn viên');
    if (input.jobId && !job) throw ApiException.notFound('Không tìm thấy đơn hàng');

    await this.prisma.lead.create({
      data: { name: input.name, phone: input.phone, employerId: employer?.id, recruiterId: recruiter?.id, jobId: job?.id },
    });
    if (recruiter?.userId) {
      await this.notifications.notify(recruiter.userId, 'lead.new', {
        title: `Khách cần tư vấn: ${input.name}`,
        body: input.phone,
        link: WEB_LINKS.employerLeads,
      });
    }
  }

  async subscribe(input: SubscribeInput): Promise<void> {
    const phone = normalizeVnPhone(input.contact);
    const contact = phone ?? input.contact.trim().toLowerCase();
    const data = { channel: phone ? 'zalo' : 'email', prefs: input.prefs, programs: input.programs, active: true };
    await this.prisma.subscription.upsert({ where: { contact }, create: { contact, ...data }, update: data });
  }
}
