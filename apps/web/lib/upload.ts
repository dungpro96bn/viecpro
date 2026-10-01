import type { PresignedUpload } from '@viecpro/shared';
import { apiRequest } from './api';

const ALLOWED = { image: ['image/jpeg', 'image/png', 'image/webp'], video: ['video/mp4'] } as const;
const MAX_BYTES = { image: 5 * 1024 * 1024, video: 50 * 1024 * 1024 } as const;

/**
 * Tải tệp thẳng lên kho (S3 / R2) bằng URL ký do API cấp, rồi để API kiểm tra nội dung tệp (RULE-BE.md mục 9.6).
 * Trả về đường dẫn tệp trong kho để lưu vào hồ sơ / tin đăng.
 */
export async function uploadAsset(file: File, kind: 'image' | 'video'): Promise<{ assetPath: string; assetUrl: string }> {
  if (!(ALLOWED[kind] as readonly string[]).includes(file.type)) throw new Error(kind === 'image' ? 'Chọn ảnh JPG, PNG hoặc WebP.' : 'Chọn video MP4.');
  if (file.size > MAX_BYTES[kind]) throw new Error(kind === 'image' ? 'Ảnh không được vượt quá 5 MB.' : 'Video không được vượt quá 50 MB.');
  const grant = await apiRequest<PresignedUpload>('/me/assets/presign', { method: 'POST', body: JSON.stringify({ kind, contentType: file.type, sizeBytes: file.size }) });
  const put = await fetch(grant.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!put.ok) throw new Error('Không tải được tệp lên kho lưu trữ.');
  return apiRequest<{ assetUrl: string; assetPath: string }>('/me/assets/complete', {
    method: 'POST',
    body: JSON.stringify({ kind, contentType: file.type, sizeBytes: file.size, assetPath: grant.assetPath }),
  });
}
