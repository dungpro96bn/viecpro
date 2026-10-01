import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ApiException } from '../src/core/http/api-exception.js';
import { AuthGuard } from '../src/core/auth/auth.guard.js';
import { MeController } from '../src/modules/me/me.controller.js';
import { MeService } from '../src/modules/me/me.service.js';
import { SeekerProfileService } from '../src/modules/me/seeker-profile.service.js';

const JWT_SECRET = 'e2e-test-secret-with-at-least-32-characters';

describe('Quyền truy cập tài khoản (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const me = {
      profile: vi.fn(),
      revokeSession: vi.fn(async (userId: string, sessionId: string) => {
        if (userId !== 'seeker-owner' || sessionId !== 'owned-session') throw ApiException.notFound('Không tìm thấy phiên đăng nhập');
      }),
    };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [MeController],
      providers: [AuthGuard, { provide: MeService, useValue: me }, { provide: SeekerProfileService, useValue: { profile: vi.fn(), insights: vi.fn() } }],
    }).compile();
    app = module.createNestApplication();
    jwt = module.get(JwtService);
    app.useGlobalGuards(module.get(AuthGuard));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  const token = (role: 'seeker' | 'employer', sub: string) => jwt.signAsync({ sub, role, sid: `${sub}-session` });

  it('trả 401 khi chưa đăng nhập', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/profile').expect(401);
  });

  it('trả 403 khi sai vai trò', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/profile').set('Authorization', `Bearer ${await token('employer', 'employer-1')}`).expect(403);
  });

  it('trả 404 khi yêu cầu đăng xuất phiên của người khác', async () => {
    await request(app.getHttpServer()).delete('/api/v1/me/sessions/other-session').set('Authorization', `Bearer ${await token('seeker', 'seeker-owner')}`).expect(404);
  });
});
