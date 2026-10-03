import { z } from 'zod';
import {
  SEEKER_DOCUMENT_KEYS,
  SEEKER_DOCUMENT_STATUSES,
  seekerExperienceSchema,
  seekerSkillSchema,
  type SeekerDocument,
  type SeekerExperience,
  type SeekerSkill,
} from '@viecpro/shared';

/** Cột Json của SeekerProfile: kiểm tra khi đọc, phần tử hỏng bị bỏ qua thay vì làm lỗi cả hồ sơ */
const storedSkill = seekerSkillSchema.extend({ verified: z.boolean().default(false) });
const storedDocument = z.object({
  key: z.enum(SEEKER_DOCUMENT_KEYS),
  status: z.enum(SEEKER_DOCUMENT_STATUSES),
  note: z.string().max(120).nullable().default(null),
  path: z.string().max(240).nullable().default(null),
  uploadedAt: z.string().max(40).nullable().default(null),
});
export type StoredDocument = z.infer<typeof storedDocument>;

function parseList<T>(schema: z.ZodType<T>, value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const r = schema.safeParse(item);
    return r.success ? [r.data] : [];
  });
}

export function readSkills(value: unknown): SeekerSkill[] {
  return parseList(storedSkill, value);
}

export function readExperiences(value: unknown): SeekerExperience[] {
  return parseList(seekerExperienceSchema, value);
}

export function readStoredDocuments(value: unknown): StoredDocument[] {
  return parseList(storedDocument, value);
}

/** Luôn đủ 4 mục theo thứ tự chuẩn – mục chưa có coi là "missing" */
export function readDocuments(value: unknown): SeekerDocument[] {
  const stored = readStoredDocuments(value);
  return SEEKER_DOCUMENT_KEYS.map((key) => {
    const d = stored.find((x) => x.key === key);
    return { key, status: d?.status ?? 'missing', note: d?.note ?? null, uploadedAt: d?.uploadedAt ?? null };
  });
}

/** Giữ cờ "đã xác nhận" của kỹ năng cũ cùng tên – client không tự đặt được cờ này */
export function mergeSkills(previous: SeekerSkill[], next: Array<Omit<SeekerSkill, 'verified'>>): SeekerSkill[] {
  const verified = new Set(previous.filter((s) => s.verified).map((s) => s.name.toLowerCase()));
  return next.map((s) => ({ ...s, verified: verified.has(s.name.toLowerCase()) }));
}

/** Kinh nghiệm mới nhất lên đầu (đang làm → kết thúc gần nhất), học vấn xuống cuối */
export function sortExperiences(list: SeekerExperience[]): SeekerExperience[] {
  const end = (e: SeekerExperience) => e.to ?? '9999';
  return [...list].sort((a, b) => (a.kind === b.kind ? end(b).localeCompare(end(a)) || b.from.localeCompare(a.from) : a.kind === 'work' ? -1 : 1));
}
