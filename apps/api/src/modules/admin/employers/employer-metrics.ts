import type { AdminEmployerItem, AdminEmployerListQuery, AdminEmployerStatus } from '@viecpro/shared';

const DAY = 86400_000;

/** Trạng thái hiển thị: tạm khoá > chờ xác minh > sắp hết gói (≤ 30 ngày) > đang hoạt động */
export function employerStatus(input: { suspended: boolean; verified: boolean; planExpiresAt: Date | null }, now: Date): AdminEmployerStatus {
  if (input.suspended) return 'suspended';
  if (!input.verified) return 'pending';
  if (input.planExpiresAt && input.planExpiresAt.getTime() >= now.getTime() && input.planExpiresAt.getTime() - now.getTime() <= 30 * DAY) return 'expiring';
  return 'active';
}

/** % thay đổi; kỳ trước = 0 thì không so được */
export function deltaPercent(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const isPaidPlan = (name: string | null | undefined) => !!name && !/miễn phí|free/i.test(name);

/** Lọc + sắp xếp danh sách NTD đã dựng sẵn (dữ liệu gộp từ 2 bảng nên xử lý trong bộ nhớ) */
export function filterEmployers(items: AdminEmployerItem[], q: AdminEmployerListQuery): AdminEmployerItem[] {
  const term = q.q?.toLowerCase();
  const digits = q.q?.replace(/\D/g, '');
  const out = items.filter(
    (i) =>
      (q.kind === 'all' || i.kind === q.kind) &&
      (q.tab === 'all' || i.status === q.tab) &&
      (!q.verified || i.verified) &&
      (!q.paid || isPaidPlan(i.plan?.name)) &&
      (!q.slowResponse || (i.responseRate !== null && i.responseRate < 60)) &&
      (!q.reported || i.reportCount > 0) &&
      (!term || i.name.toLowerCase().includes(term) || i.subtitle.toLowerCase().includes(term) || (!!digits && digits.length >= 3 && i.subtitle.replace(/\D/g, '').includes(digits))),
  );
  const by: Record<AdminEmployerListQuery['sort'], (a: AdminEmployerItem, b: AdminEmployerItem) => number> = {
    applicants: (a, b) => b.applicants30d - a.applicants30d,
    jobs: (a, b) => b.openJobs - a.openJobs || b.totalJobs - a.totalJobs,
    reports: (a, b) => b.reportCount - a.reportCount,
    newest: () => 0,
  };
  return q.sort === 'newest' ? out : [...out].sort((a, b) => by[q.sort](a, b) || a.name.localeCompare(b.name, 'vi'));
}
