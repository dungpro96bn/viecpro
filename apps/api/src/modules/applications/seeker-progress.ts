import { SEEKER_APPLICATION_STEPS, type ApplicationStatus, type SeekerApplicationStepItem, type SeekerApplicationTab } from '@viecpro/shared';

/** Trạng thái hồ sơ ↔ tab ở trang "Việc đã ứng tuyển" */
export const TAB_STATUSES: Record<Exclude<SeekerApplicationTab, 'all'>, ApplicationStatus[]> = {
  processing: ['submitted', 'viewed'],
  interview: ['interview'],
  passed: ['passed', 'departed'],
  closed: ['rejected', 'withdrawn'],
};

const REACHED: Record<ApplicationStatus, number> = { submitted: 0, viewed: 1, interview: 2, passed: 3, departed: 4, rejected: -1, withdrawn: -1 };

/**
 * 5 bước Đã gửi → Cán bộ xem → Phỏng vấn → Trúng tuyển → Xuất cảnh.
 * Bước đã qua: done · bước hiện tại: current (đang chờ) · bị loại / rút: bước cuối cùng đã đến là failed.
 */
export function buildSteps(status: ApplicationStatus, events: Array<{ status: ApplicationStatus; createdAt: Date }>, interviewAt: Date | null): SeekerApplicationStepItem[] {
  const firstAt = (s: ApplicationStatus) => events.find((e) => e.status === s)?.createdAt ?? null;
  const closed = status === 'rejected' || status === 'withdrawn';
  // Hồ sơ bị loại / rút: bước xa nhất đã đến theo lịch sử
  const reached = closed ? Math.max(0, ...events.map((e) => REACHED[e.status])) : REACHED[status];
  const finished = status === 'passed' || status === 'departed';
  return SEEKER_APPLICATION_STEPS.map((key, i) => {
    const at = key === 'interview' && status === 'interview' && interviewAt ? interviewAt : firstAt(key);
    const state: SeekerApplicationStepItem['state'] = i < reached ? 'done' : i > reached ? 'todo' : closed ? 'failed' : finished ? 'done' : 'current';
    return { key, at: i <= reached ? (at ?? (closed ? firstAt(status) : null))?.toISOString() ?? null : null, state };
  });
}

/** % hồ sơ được mời phỏng vấn (đã có lịch hẹn hoặc đi xa hơn) */
export function inviteRate(apps: Array<{ status: ApplicationStatus; events: Array<{ status: ApplicationStatus }> }>): number | null {
  const counted = apps.filter((a) => a.status !== 'withdrawn');
  if (!counted.length) return null;
  const invited = counted.filter((a) => ['interview', 'passed', 'departed'].includes(a.status) || a.events.some((e) => e.status === 'interview'));
  return Math.round((invited.length / counted.length) * 100);
}
