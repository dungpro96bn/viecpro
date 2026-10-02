import { GENDER_LABEL, PROGRAM_LABEL, REGION_LABEL, jobAlertCriteriaSchema, type AlertFrequency, type JobAlertCriteria } from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { buildJobWhere } from '../jobs/job-query.js';

/** Đọc tiêu chí đã lưu (JSON) – dữ liệu hỏng thì dùng mặc định thay vì làm hỏng cả trang */
export function parseCriteria(raw: unknown): JobAlertCriteria {
  const r = jobAlertCriteriaSchema.safeParse(raw ?? {});
  return r.success ? r.data : jobAlertCriteriaSchema.parse({});
}

/** Tiêu chí → điều kiện Prisma (chỉ tin đang tuyển). `since`: chỉ tin công khai sau mốc này */
export function criteriaWhere(c: JobAlertCriteria, since?: Date): Prisma.JobWhereInput {
  const base = buildJobWhere({
    page: 1,
    limit: 1,
    sort: 'newest',
    pref: c.prefs.length ? c.prefs : undefined,
    region: c.regions.length ? c.regions : undefined,
    program: c.programs.length ? c.programs : undefined,
    industry: c.industries.length ? c.industries : undefined,
    gender: c.gender ?? undefined,
    salaryMin: c.salaryMin ?? undefined,
  });
  const and = [base];
  if (c.freeOnly) and.push({ OR: [{ feeUsd: 0 }, { tags: { has: 'Đơn miễn phí' } }] });
  if (since) and.push({ publishedAt: { gt: since } });
  return { AND: and };
}

/** Chip hiển thị trên thẻ thông báo: ngành, khu vực, chương trình, lương, miễn phí, giới tính */
export function criteriaChips(c: JobAlertCriteria): string[] {
  const chips = [
    ...c.industries.map((i) => i.split(' – ')[0]!),
    ...(c.prefs.length || c.regions.length ? [...c.prefs, ...c.regions.map((r) => REGION_LABEL[r])] : ['Toàn Nhật Bản']),
    ...c.programs.map((p) => PROGRAM_LABEL[p]),
    ...(c.salaryMin ? [`Lương ≥ ${c.salaryMin.toLocaleString('vi-VN')} ¥`] : []),
    ...(c.freeOnly ? ['Miễn phí'] : []),
    ...(c.gender ? [GENDER_LABEL[c.gender]] : []),
  ];
  return chips;
}

/** Tên tự đặt khi người dùng bỏ trống: "Điện tử · Kanto · Miễn phí" (tối đa 3 ý) */
export function defaultAlertName(c: JobAlertCriteria): string {
  const parts = [
    c.industries[0]?.split(' – ')[0] ?? (c.programs[0] && PROGRAM_LABEL[c.programs[0]]),
    c.prefs[0] ?? (c.regions[0] && REGION_LABEL[c.regions[0]]),
    c.freeOnly ? 'Miễn phí' : c.salaryMin ? 'lương cao' : c.gender ? GENDER_LABEL[c.gender] : undefined,
  ].filter(Boolean);
  return (parts.length ? parts.join(' · ') : 'Việc làm mới').slice(0, 60);
}

const VN_OFFSET_MS = 7 * 3600_000;
const SEND_HOUR_VN = 8;

/** Mốc 8:00 giờ Việt Nam gần nhất đã qua (daily) hoặc 8:00 sáng Thứ Hai gần nhất (weekly) */
export function lastSlot(frequency: Exclude<AlertFrequency, 'instant'>, now: Date): Date {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const slot = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), SEND_HOUR_VN));
  if (slot.getTime() > vn.getTime()) slot.setUTCDate(slot.getUTCDate() - 1);
  if (frequency === 'weekly') {
    // getUTCDay: 0 = Chủ nhật, 1 = Thứ Hai
    const back = (slot.getUTCDay() + 6) % 7;
    slot.setUTCDate(slot.getUTCDate() - back);
  }
  return new Date(slot.getTime() - VN_OFFSET_MS);
}

/**
 * Đến lượt gửi chưa? instant: luôn kiểm tra (tin mới sau lastSentAt);
 * daily / weekly: đã qua mốc gửi mà lần gửi trước còn trước mốc đó.
 */
export function isDue(alert: { frequency: AlertFrequency; lastSentAt: Date | null; createdAt: Date }, now: Date): boolean {
  if (alert.frequency === 'instant') return true;
  const slot = lastSlot(alert.frequency, now);
  const last = alert.lastSentAt ?? alert.createdAt;
  return last.getTime() < slot.getTime();
}
