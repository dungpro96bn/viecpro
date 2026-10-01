import { slugify } from '@viecpro/shared';

/** Tạo slug không trùng: "cong-ty-abc", "cong-ty-abc-2"… */
export async function uniqueSlug(text: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(text) || 'tai-khoan';
  let slug = base;
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
  return slug;
}
