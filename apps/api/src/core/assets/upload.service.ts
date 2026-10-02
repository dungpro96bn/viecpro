import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CompleteUploadInput, PresignUploadInput, PresignedUpload } from '@viecpro/shared';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ENV, type Env } from '../../config/env.js';
import { ApiException } from '../http/api-exception.js';
import { AssetUrlService } from './asset-url.service.js';

const EXTENSION: Record<CompleteUploadInput['contentType'], string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4',
};

function contentMatches(contentType: CompleteUploadInput['contentType'], bytes: Uint8Array) {
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (contentType === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
}

const UPLOAD_TTL_SECONDS = 300;

/** Quyền tải 1 tệp lên kho cục bộ – thay cho presigned URL của S3 khi STORAGE_PROVIDER=local */
interface LocalGrant {
  path: string;
  contentType: CompleteUploadInput['contentType'];
  sizeBytes: number;
  exp: number;
}

@Injectable()
export class UploadService {
  private readonly s3: S3Client | null;
  /** Thư mục gốc lưu tệp khi STORAGE_PROVIDER=local */
  readonly localRoot: string;

  constructor(@Inject(ENV) private readonly env: Env, private readonly assets: AssetUrlService) {
    this.s3 = env.STORAGE_PROVIDER === 's3' ? new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT, forcePathStyle: true }),
      ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && { credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } }),
    }) : null;
    this.localRoot = resolve(env.LOCAL_STORAGE_DIR);
  }

  private get local() {
    return this.env.STORAGE_PROVIDER === 'local';
  }

  async presign(userId: string, input: PresignUploadInput): Promise<PresignedUpload> {
    const assetPath = `uploads/${userId}/${randomUUID()}.${EXTENSION[input.contentType]}`;
    if (this.local) {
      const grant: LocalGrant = { path: assetPath, contentType: input.contentType, sizeBytes: input.sizeBytes, exp: Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS };
      const uploadUrl = `${this.env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/uploads/${this.signGrant(grant)}`;
      return { uploadUrl, assetPath, assetUrl: this.assets.url(assetPath), expiresIn: UPLOAD_TTL_SECONDS };
    }
    if (!this.s3 || !this.env.S3_BUCKET) throw new ApiException('NOT_IMPLEMENTED', 'Tải tệp lên chưa được cấu hình', HttpStatus.SERVICE_UNAVAILABLE);
    const command = new PutObjectCommand({ Bucket: this.env.S3_BUCKET, Key: assetPath, ContentType: input.contentType, ContentLength: input.sizeBytes });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: UPLOAD_TTL_SECONDS });
    return { uploadUrl, assetPath, assetUrl: this.assets.url(assetPath), expiresIn: UPLOAD_TTL_SECONDS };
  }

  async complete(userId: string, input: CompleteUploadInput): Promise<{ assetUrl: string; assetPath: string }> {
    const prefix = `uploads/${userId}/`;
    const filename = input.assetPath.startsWith(prefix) ? input.assetPath.slice(prefix.length) : '';
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/i.test(filename) || !filename.endsWith(`.${EXTENSION[input.contentType]}`)) {
      throw ApiException.notFound('Không tìm thấy tệp tải lên');
    }
    const key = input.assetPath;
    if (this.local) return this.completeLocal(input);
    if (!this.s3 || !this.env.S3_BUCKET) throw new ApiException('NOT_IMPLEMENTED', 'Tải tệp lên chưa được cấu hình', HttpStatus.SERVICE_UNAVAILABLE);
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
      if (head.ContentLength !== input.sizeBytes || head.ContentType !== input.contentType) throw new Error('upload metadata mismatch');
      const object = await this.s3.send(new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
      if (!object.Body) throw new Error('upload body missing');
      let prefix = Buffer.alloc(0);
      for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
        prefix = Buffer.concat([prefix, Buffer.from(chunk)]).subarray(0, 12);
        if (prefix.length >= 12) break;
      }
      if (!contentMatches(input.contentType, prefix)) throw new Error('upload content mismatch');
      return { assetPath: key, assetUrl: this.assets.url(key) ?? '' };
    } catch {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key })).catch(() => undefined);
      throw invalidUpload();
    }
  }

  /** Nhận nội dung tệp cho link tải lên cục bộ (PUT /uploads/:token). Mỗi link chỉ ghi được 1 lần */
  async receiveLocal(token: string, contentType: string | undefined, body: Readable): Promise<void> {
    const grant = this.local ? this.verifyGrant(token) : null;
    if (!grant) throw ApiException.notFound('Link tải lên không hợp lệ hoặc đã hết hạn');
    if (contentType?.split(';')[0].trim() !== grant.contentType) throw invalidUpload();
    const file = this.localFile(grant.path);
    if (await stat(file).catch(() => null)) throw new ApiException('CONFLICT', 'Link tải lên đã được dùng', HttpStatus.CONFLICT);
    await mkdir(dirname(file), { recursive: true });
    const partial = `${file}.${randomUUID()}.part`;
    let received = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        callback(received > grant.sizeBytes ? new Error('upload too large') : null, chunk);
      },
    });
    try {
      await pipeline(body, limit, createWriteStream(partial, { flags: 'wx' }));
      if (received !== grant.sizeBytes) throw new Error('upload size mismatch');
      await rename(partial, file);
    } catch {
      await rm(partial, { force: true });
      throw invalidUpload();
    }
  }

  private async completeLocal(input: CompleteUploadInput) {
    const file = this.localFile(input.assetPath);
    try {
      const info = await stat(file);
      if (info.size !== input.sizeBytes) throw new Error('upload size mismatch');
      const handle = await open(file, 'r');
      const head = Buffer.alloc(12);
      await handle.read(head, 0, 12, 0).finally(() => handle.close());
      if (!contentMatches(input.contentType, head)) throw new Error('upload content mismatch');
      return { assetPath: input.assetPath, assetUrl: this.assets.url(input.assetPath) };
    } catch {
      await rm(file, { force: true });
      throw invalidUpload();
    }
  }

  private localFile(assetPath: string) {
    const file = resolve(this.localRoot, assetPath);
    if (!file.startsWith(`${this.localRoot}/`)) throw ApiException.notFound('Không tìm thấy tệp tải lên');
    return file;
  }

  private sign(data: string) {
    return createHmac('sha256', this.env.JWT_SECRET).update(`upload:${data}`).digest('base64url');
  }

  private signGrant(grant: LocalGrant) {
    const data = Buffer.from(JSON.stringify(grant)).toString('base64url');
    return `${data}.${this.sign(data)}`;
  }

  private verifyGrant(token: string): LocalGrant | null {
    const [data, signature, extra] = token.split('.');
    if (!data || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.sign(data));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const grant = JSON.parse(Buffer.from(data, 'base64url').toString()) as LocalGrant;
      return grant.exp >= Date.now() / 1000 ? grant : null;
    } catch {
      return null;
    }
  }
}

function invalidUpload() {
  return new ApiException('VALIDATION_ERROR', 'Tệp tải lên không hợp lệ hoặc đã hết hạn', HttpStatus.BAD_REQUEST);
}
