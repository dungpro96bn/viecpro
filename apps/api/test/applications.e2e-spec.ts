import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { ApiException } from '../src/core/http/api-exception.js';
import { ApplicationsController } from '../src/modules/applications/applications.controller.js';
import { ApplicationsService } from '../src/modules/applications/applications.service.js';
import { ApplyEmailOtpService } from '../src/modules/applications/apply-email-otp.service.js';
import { SeekerApplicationsController } from '../src/modules/applications/seeker-applications.controller.js';
import { SeekerApplicationsService } from '../src/modules/applications/seeker-applications.service.js';

const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';

describe('Ứng tuyển & việc đã ứng tuyển (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const apply = vi.fn(async () => ({ id: 'app-1' }));
  const sendOtp = vi.fn(async () => ({ verified: false, email: 'la•••99@gmail.com', resendAfter: 60, expiresIn: 300 }));

  beforeAll(async () => {
    const seeker = {
      withdraw: vi.fn(async (userId: string, id: string) => {
        // Hồ sơ của người khác: không tìm thấy (không trả 403 để không lộ bản ghi)
        if (userId !== 'seeker-owner' || id !== 'own-app') throw ApiException.notFound('Không tìm thấy hồ sơ ứng tuyển');
        return { id };
      }),
      list: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false, counts: {} })),
    };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [ApplicationsController, SeekerApplicationsController],
      providers: [
        AuthGuard,
        { provide: ApplicationsService, useValue: { apply } },
        { provide: ApplyEmailOtpService, useValue: { send: sendOtp } },
        { provide: SeekerApplicationsService, useValue: seeker },
      ],
    }).compile();
    app = module.createNestApplication();
    jwt = module.get(JwtService);
    app.useGlobalGuards(module.get(AuthGuard));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const token = (role: 'seeker' | 'employer', sub: string) => jwt.signAsync({ sub, role, sid: `${sub}-session` });
  const body = { jobSlug: 'don-a', fullName: 'Nguyễn Thị Lan', phone: '0912345678', email: 'lan@gmail.com', birthYear: 1999, gender: 'nu' };

  it('gửi mã OTP email: công khai, chuẩn hoá email', async () => {
    await request(app.getHttpServer()).post('/api/v1/applications/email-otp').send({ jobSlug: 'don-a', email: '  Lan@Gmail.com ' }).expect(200);
    expect(sendOtp).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'lan@gmail.com' }), undefined);
  });

  it('ứng tuyển bắt buộc có email, mã OTP phải đúng 6 số', async () => {
    const { email: _omit, ...noEmail } = body;
    await request(app.getHttpServer()).post('/api/v1/applications').send(noEmail).expect(400);
    await request(app.getHttpServer()).post('/api/v1/applications').send({ ...body, emailCode: '12ab' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/applications').send({ ...body, emailCode: '123456' }).expect(201);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('việc đã ứng tuyển: 401 chưa đăng nhập, 403 sai vai trò, 404 hồ sơ người khác', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/applications').expect(401);
    await request(app.getHttpServer()).get('/api/v1/me/applications').set('Authorization', `Bearer ${await token('employer', 'emp-1')}`).expect(403);
    await request(app.getHttpServer()).post('/api/v1/me/applications/other-app/withdraw').set('Authorization', `Bearer ${await token('seeker', 'seeker-owner')}`).expect(404);
    await request(app.getHttpServer()).post('/api/v1/me/applications/own-app/withdraw').set('Authorization', `Bearer ${await token('seeker', 'seeker-owner')}`).expect(201);
  });
});
