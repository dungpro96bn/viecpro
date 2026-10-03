import type { companyProfileSectionsSchema, recruiterProfileSectionsSchema } from '@viecpro/shared';
import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';

type SectionsSchema = typeof recruiterProfileSectionsSchema | typeof companyProfileSectionsSchema;

/** Đọc từng khối sửa được trong `sections` (JSON) – khối hỏng thì để trống thay vì làm hỏng cả trang */
export function readSections<S extends SectionsSchema>(schema: S, stored: unknown): z.infer<S> {
  const raw = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const parsed = (field as z.ZodType).safeParse(raw[key]);
    out[key] = parsed.success ? parsed.data : [];
  }
  return out as z.infer<S>;
}

/** Ghi đè khối sửa được, giữ nguyên khối admin quản lý (legal, checks, contacts…) */
export const mergeSections = (stored: unknown, edited: object): Prisma.InputJsonObject => ({
  ...(stored && typeof stored === 'object' ? (stored as Prisma.InputJsonObject) : {}),
  ...(edited as Prisma.InputJsonObject),
});
