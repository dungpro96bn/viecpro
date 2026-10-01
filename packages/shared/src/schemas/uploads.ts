import { z } from 'zod';

export const presignUploadSchema = z.object({
  kind: z.enum(['image', 'video']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  sizeBytes: z.coerce.number().int().min(1).max(50 * 1024 * 1024),
}).superRefine((value, ctx) => {
  const image = value.contentType.startsWith('image/');
  if ((value.kind === 'image') !== image) ctx.addIssue({ code: 'custom', path: ['contentType'], message: 'Loại tệp không khớp với nội dung tải lên' });
  if (image && value.sizeBytes > 5 * 1024 * 1024) ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: 'Ảnh không được vượt quá 5 MB' });
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const completeUploadSchema = presignUploadSchema.extend({ assetPath: z.string().trim().min(1).max(240) });
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
