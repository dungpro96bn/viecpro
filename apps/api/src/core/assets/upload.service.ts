import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CompleteUploadInput, PresignUploadInput, PresignedUpload } from '@viecpro/shared';
import { randomUUID } from 'node:crypto';
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

@Injectable()
export class UploadService {
  private readonly s3: S3Client | null;

  constructor(@Inject(ENV) private readonly env: Env, private readonly assets: AssetUrlService) {
    this.s3 = env.STORAGE_PROVIDER === 's3' ? new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT, forcePathStyle: true }),
      ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && { credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } }),
    }) : null;
  }

  async presign(userId: string, input: PresignUploadInput): Promise<PresignedUpload> {
    if (!this.s3 || !this.env.S3_BUCKET) throw new ApiException('NOT_IMPLEMENTED', 'Tải tệp lên chưa được cấu hình', HttpStatus.SERVICE_UNAVAILABLE);
    const assetPath = `uploads/${userId}/${randomUUID()}.${EXTENSION[input.contentType]}`;
    const command = new PutObjectCommand({ Bucket: this.env.S3_BUCKET, Key: assetPath, ContentType: input.contentType, ContentLength: input.sizeBytes });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    return { uploadUrl, assetPath, assetUrl: this.assets.url(assetPath) ?? '', expiresIn: 300 };
  }

  async complete(userId: string, input: CompleteUploadInput): Promise<{ assetUrl: string; assetPath: string }> {
    if (!this.s3 || !this.env.S3_BUCKET) throw new ApiException('NOT_IMPLEMENTED', 'Tải tệp lên chưa được cấu hình', HttpStatus.SERVICE_UNAVAILABLE);
    const prefix = `uploads/${userId}/`;
    const filename = input.assetPath.startsWith(prefix) ? input.assetPath.slice(prefix.length) : '';
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/i.test(filename) || !filename.endsWith(`.${EXTENSION[input.contentType]}`)) {
      throw ApiException.notFound('Không tìm thấy tệp tải lên');
    }
    const key = input.assetPath;
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
      throw new ApiException('VALIDATION_ERROR', 'Tệp tải lên không hợp lệ hoặc đã hết hạn', HttpStatus.BAD_REQUEST);
    }
  }
}
