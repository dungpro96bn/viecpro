import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { LeadsService } from './leads.service.js';

describe('LeadsService.consult', () => {
  const employer = { id: 'employer-1' };
  const admins = [{ userId: 'admin-1' }, { userId: 'admin-2' }];
  const prismaMocks = {
    employer: { findUnique: vi.fn() },
    recruiter: { findUnique: vi.fn(), findMany: vi.fn() },
    job: { findFirst: vi.fn() },
    lead: { create: vi.fn() },
  };
  const prisma = prismaMocks as unknown as PrismaService;
  const notificationsMock = { notify: vi.fn() };
  const notifications = notificationsMock as unknown as NotificationsService;
  const service = new LeadsService(prisma, notifications);

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.employer.findUnique.mockResolvedValue(employer);
    prismaMocks.recruiter.findUnique.mockResolvedValue(null);
    prismaMocks.recruiter.findMany.mockResolvedValue(admins);
    prismaMocks.job.findFirst.mockResolvedValue(null);
    prismaMocks.lead.create.mockResolvedValue({});
    notificationsMock.notify.mockResolvedValue(undefined);
  });

  it('notifies all active company administrators for a company page lead', async () => {
    await service.consult({ name: 'Nguyễn An', phone: '0912345678', employerSlug: 'viecpro' });

    expect(prismaMocks.lead.create).toHaveBeenCalledWith({ data: { name: 'Nguyễn An', phone: '0912345678', employerId: employer.id, recruiterId: undefined, jobId: undefined } });
    expect(prismaMocks.recruiter.findMany).toHaveBeenCalledWith({
      where: { employerId: employer.id, companyAdmin: true, leftAt: null, userId: { not: null } },
      select: { userId: true },
    });
    expect(notificationsMock.notify.mock.calls.map(([userId]) => userId)).toEqual(['admin-1', 'admin-2']);
  });

  it('does not fail the lead submission if notification delivery fails', async () => {
    notificationsMock.notify.mockRejectedValue(new Error('notification storage unavailable'));

    await expect(service.consult({ name: 'Nguyễn An', phone: '0912345678', employerSlug: 'viecpro' })).resolves.toBeUndefined();
    expect(prismaMocks.lead.create).toHaveBeenCalledOnce();
  });
});
