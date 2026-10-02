import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { loadEnv } from '../../config/env.js';
import { AssetUrlService } from './asset-url.service.js';
import { UploadService } from './upload.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4]);
const USER = 'user1';

describe('UploadService (lưu cục bộ)', () => {
  let dir: string;
  let service: UploadService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'viecpro-upload-'));
    const env = loadEnv({
      DATABASE_URL: 'postgresql://x',
      JWT_SECRET: 'jwt-secret-random-value-0123456789abcdef',
      OTP_SECRET: 'otp-secret-random-value-0123456789abcdef',
      ADMIN_MFA_KEY: 'mfa-secret-random-value-0123456789abcdef',
      LOCAL_STORAGE_DIR: dir,
      API_PUBLIC_URL: 'http://localhost:4000',
    });
    service = new UploadService(env, new AssetUrlService(env));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  const grant = () => service.presign(USER, { kind: 'image', contentType: 'image/png', sizeBytes: PNG.length });
  const tokenOf = (url: string) => url.split('/uploads/')[1];

  it('cấp link tải lên của API và URL xem tệp tuyệt đối', async () => {
    const g = await grant();
    expect(g.uploadUrl).toMatch(/^http:\/\/localhost:4000\/api\/v1\/uploads\/[\w-]+\.[\w-]+$/);
    expect(g.assetPath).toMatch(/^uploads\/user1\/[0-9a-f-]{36}\.png$/);
    expect(g.assetUrl).toBe(`http://localhost:4000/files/${g.assetPath}`);
  });

  it('nhận tệp, kiểm tra nội dung rồi trả URL', async () => {
    const g = await grant();
    await service.receiveLocal(tokenOf(g.uploadUrl), 'image/png', Readable.from([PNG]));
    expect(await readFile(join(dir, g.assetPath))).toEqual(PNG);
    const done = await service.complete(USER, { kind: 'image', contentType: 'image/png', sizeBytes: PNG.length, assetPath: g.assetPath });
    expect(done.assetUrl).toBe(g.assetUrl);
  });

  it('từ chối link bị sửa, sai loại tệp, quá dung lượng và dùng lại link', async () => {
    const g = await grant();
    const token = tokenOf(g.uploadUrl);
    await expect(service.receiveLocal(`${token}x`, 'image/png', Readable.from([PNG]))).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    await expect(service.receiveLocal(token, 'image/jpeg', Readable.from([PNG]))).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    await expect(service.receiveLocal(token, 'image/png', Readable.from([PNG, PNG]))).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    await service.receiveLocal(token, 'image/png', Readable.from([PNG]));
    await expect(service.receiveLocal(token, 'image/png', Readable.from([PNG]))).rejects.toMatchObject({ response: { code: 'CONFLICT' } });
  });

  it('xoá tệp có nội dung không khớp loại khai báo', async () => {
    const fake = Buffer.alloc(PNG.length, 1);
    const g = await grant();
    await service.receiveLocal(tokenOf(g.uploadUrl), 'image/png', Readable.from([fake]));
    await expect(service.complete(USER, { kind: 'image', contentType: 'image/png', sizeBytes: fake.length, assetPath: g.assetPath })).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    await expect(readFile(join(dir, g.assetPath))).rejects.toThrow();
  });
});
