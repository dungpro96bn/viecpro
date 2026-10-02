import type { ReportSeverity } from '@viecpro/shared';
import { SEVERITY_RANK } from '../../reports/report-rules.js';

export interface CaseReport {
  id: string;
  number: number;
  targetType: 'job' | 'employer' | 'recruiter' | 'user';
  jobId: string | null;
  employerId: string | null;
  recruiterId: string | null;
  targetUserId: string | null;
  reason: string;
  severity: ReportSeverity;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  dueAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

/** Id đối tượng bị báo cáo theo loại */
export function targetIdOf(r: Pick<CaseReport, 'targetType' | 'jobId' | 'employerId' | 'recruiterId' | 'targetUserId'>): string | null {
  return r.targetType === 'job' ? r.jobId : r.targetType === 'employer' ? r.employerId : r.targetType === 'recruiter' ? r.recruiterId : r.targetUserId;
}

/** Báo cáo cùng đối tượng + cùng lý do + cùng nhóm trạng thái là một "vụ" (gộp báo cáo – spec A-06) */
export function caseKey(r: CaseReport): string {
  const bucket = r.status === 'open' || r.status === 'investigating' ? 'active' : r.status;
  return `${r.targetType}:${targetIdOf(r) ?? r.id}:${r.reason}:${bucket}`;
}

export function groupCases<T extends CaseReport>(reports: T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const r of reports) {
    const key = caseKey(r);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  // Báo cáo cũ nhất làm đại diện (mã vụ, id thao tác)
  return [...map.values()].map((list) => [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
}

/** Mức độ vụ = mức cao nhất; hạn = hạn sớm nhất */
export function caseSeverity(list: CaseReport[]): ReportSeverity {
  return list.reduce<ReportSeverity>((best, r) => (SEVERITY_RANK[r.severity] < SEVERITY_RANK[best] ? r.severity : best), 'low');
}

export function caseDueAt(list: CaseReport[]): Date | null {
  const times = list.map((r) => r.dueAt?.getTime()).filter((t): t is number => t !== undefined);
  return times.length ? new Date(Math.min(...times)) : null;
}

/** Ưu tiên = mức độ × hạn xử lý: nghiêm trọng trước, cùng mức thì hạn sớm trước */
export function comparePriority(a: CaseReport[], b: CaseReport[]): number {
  const s = SEVERITY_RANK[caseSeverity(a)] - SEVERITY_RANK[caseSeverity(b)];
  if (s) return s;
  return (caseDueAt(a)?.getTime() ?? Infinity) - (caseDueAt(b)?.getTime() ?? Infinity);
}
