import type { ReportReason, ReportSeverity } from '@viecpro/shared';

/** Mức độ theo lý do (spec 3.9): lừa đảo / thu phí ngoài là nghiêm trọng */
export const REASON_SEVERITY: Record<ReportReason, ReportSeverity> = {
  fee: 'critical',
  scam: 'critical',
  harassment: 'high',
  wrong_info: 'medium',
  fake_photo: 'medium',
  duplicate: 'low',
  no_response: 'low',
  partner_request: 'medium',
  other: 'low',
};

/** Hạn xử lý theo mức độ (giờ): critical 2h · high 8h · medium 24h · low 72h */
export const SEVERITY_SLA_HOURS: Record<ReportSeverity, number> = { critical: 2, high: 8, medium: 24, low: 72 };

export function severityOf(reason: string): ReportSeverity {
  return REASON_SEVERITY[reason as ReportReason] ?? 'medium';
}

export function dueAtFor(severity: ReportSeverity, from: Date): Date {
  return new Date(from.getTime() + SEVERITY_SLA_HOURS[severity] * 3600_000);
}

/** Tin bị ≥ 3 người báo "thu phí" trong 24 giờ → tự tạm ẩn */
export const AUTO_HIDE_FEE_REPORTS = 3;
export const AUTO_HIDE_WINDOW_MS = 24 * 3600_000;

export function shouldAutoHide(distinctFeeReporters24h: number): boolean {
  return distinctFeeReporters24h >= AUTO_HIDE_FEE_REPORTS;
}

/** Thứ tự ưu tiên trên trang admin: mức độ trước, rồi hạn xử lý sớm hơn */
export const SEVERITY_RANK: Record<ReportSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const reportCode = (n: number) => `BC-${n}`;
