import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from '../src/core/http/all-exceptions.filter.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { LeadsController } from '../src/modules/leads/leads.controller.js';
import { LeadsService } from '../src/modules/leads/leads.service.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';

describe('POST /leads/consultations company page notification (e2e)', () => {
  let app: INestApplication;
  const notified: string[] = [];
  const leadCreate = vi.fn();
  const prisma = {
    employer: { findUnique: vi.fn(async () => ({ id: 'employer-1' })) },
    recruiter: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => [{ userId: 'admin-1' }]),
    },
    job: { findFirst: vi.fn(async () => null) },
    lead: { create: leadCreate },
  };

  beforeAll(async () => {
    const notifications = { notify: vi.fn(async (userId: string) => { notified.push(userId); }) };
    const module = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    notified.length = 0;
    vi.clearAllMocks();
    vi.mocked(leadCreate).mockResolvedValue({} as never);
  });

  afterAll(async () => app.close());

  it('stores a company page lead and notifies company administrators (not ordinary members)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/leads/consultations')
      .send({ name: 'Nguyễn An', phone: '0912345678', employerSlug: 'viecpro' })
      .expect(204);

    expect(leadCreate).toHaveBeenCalledOnce();
    expect(prisma.recruiter.findMany).toHaveBeenCalledWith({
      where: { employerId: 'employer-1', companyAdmin: true, leftAt: null, userId: { not: null } },
      select: { userId: true },
    });
    expect(notified).toEqual(['admin-1']);
  });
});
