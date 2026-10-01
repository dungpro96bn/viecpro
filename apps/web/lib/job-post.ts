/** Logic hiển thị của form đăng tin (design 15): kiểm tra tiêu đề, điểm chất lượng tin, % hoàn thiện */
import type { EducationLevel, Industry, JobBenefit, JobChannel, JobGender, JobVisibility, JlptLevel, Program, ScreeningKind } from '@viecpro/shared';

export interface JobPostDraft {
  title: string;
  program: Program | '';
  industry: Industry | '';
  position: string;
  pref: string;
  quantity: number;
  examAt: string;
  gallery: string[];
  gender: JobGender | '';
  ageFrom: number;
  ageTo: number;
  jlpt: JlptLevel | '';
  educationMin: EducationLevel | '';
  otherRequirements: string[];
  description: string;
  salary: number;
  overtimeHours: number;
  contractYears: number;
  feeUsd: string;
  benefits: JobBenefit[];
  deadline: string;
  departureAt: string;
  recruiterId: string;
  channels: JobChannel[];
  screening: Array<{ question: string; kind: ScreeningKind; rejectIf?: string }>;
  visibility: JobVisibility;
}

export const EMPTY_DRAFT: JobPostDraft = {
  title: '',
  program: 'tts',
  industry: '',
  position: '',
  pref: '',
  quantity: 10,
  examAt: '',
  gallery: [],
  gender: '',
  ageFrom: 18,
  ageTo: 30,
  jlpt: '',
  educationMin: 'thpt',
  otherRequirements: [],
  description: '',
  salary: 0,
  overtimeHours: 30,
  contractYears: 3,
  feeUsd: '',
  benefits: [],
  deadline: '',
  departureAt: '',
  recruiterId: '',
  channels: ['viecpro'],
  screening: [],
  visibility: 'standard',
};

/** 4 thông tin nên có trong tiêu đề */
export function titleChecks(d: JobPostDraft) {
  const t = d.title.toLowerCase();
  const words = d.position.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return [
    { key: 'quantity', label: 'Số lượng', ok: /\d+/.test(t) },
    { key: 'gender', label: 'Giới tính', ok: /\bnam\b|\bnữ\b/.test(t) },
    { key: 'work', label: 'Công việc', ok: words.length ? words.some((w) => t.includes(w)) : t.length > 25 },
    { key: 'pref', label: 'Tỉnh làm việc', ok: !!d.pref && t.includes(d.pref.toLowerCase()) },
  ];
}

export interface QualityItem {
  key: string;
  label: string;
  note: string;
  points: number;
  ok: boolean;
}

/** Điểm chất lượng tin (tổng 100) – tiêu chí theo design 15 */
export function qualityOf(d: JobPostDraft): { score: number; items: QualityItem[] } {
  const items: QualityItem[] = [
    { key: 'title', label: 'Tiêu đề đủ 4 thông tin', note: 'Số lượng · giới tính · công việc · tỉnh', points: 20, ok: titleChecks(d).every((c) => c.ok) },
    { key: 'salary', label: 'Lương rõ ràng', note: 'Có lương cơ bản và làm thêm', points: 20, ok: d.salary >= 50000 && d.overtimeHours >= 0 },
    { key: 'benefits', label: 'Từ 3 phúc lợi trở lên', note: `Đang có ${d.benefits.length} phúc lợi`, points: 15, ok: d.benefits.length >= 3 },
    { key: 'fee', label: 'Công khai chi phí xuất cảnh', note: 'Tăng lượt ứng tuyển', points: 15, ok: d.feeUsd !== '' },
    { key: 'photos', label: 'Có 3 ảnh thực tế', note: `Đang có ${d.gallery.length} ảnh`, points: 12, ok: d.gallery.length >= 3 },
    { key: 'description', label: 'Mô tả công việc cụ thể', note: 'Ít nhất 3 dòng', points: 10, ok: d.description.split('\n').filter((l) => l.trim()).length >= 3 },
    { key: 'requirements', label: 'Yêu cầu cụ thể', note: `${d.otherRequirements.length} yêu cầu`, points: 8, ok: d.otherRequirements.length >= 2 },
  ];
  return { score: items.reduce((s, i) => s + (i.ok ? i.points : 0), 0), items };
}

/** Trạng thái 4 bước của form */
export function stepsOf(d: JobPostDraft) {
  return [
    { key: 'basic', label: 'Thông tin cơ bản', done: d.title.trim().length >= 10 && !!d.program && !!d.industry && !!d.pref && d.quantity > 0 },
    { key: 'requirements', label: 'Yêu cầu', done: !!d.gender && d.ageFrom > 0 && d.ageTo >= d.ageFrom && d.description.trim().length > 0 },
    { key: 'salary', label: 'Lương & phúc lợi', done: d.salary >= 50000 && d.contractYears > 0 },
    { key: 'display', label: 'Hiển thị', done: !!d.deadline },
  ];
}

/** % hoàn thiện theo số trường bắt buộc / nên có đã điền */
export function completionOf(d: JobPostDraft): number {
  const fields = [d.title.trim().length >= 10, !!d.industry, !!d.pref, d.quantity > 0, !!d.gender, d.description.trim().length > 0, d.salary >= 50000, d.contractYears > 0, !!d.deadline, d.benefits.length > 0, d.gallery.length > 0, d.feeUsd !== ''];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

/** Lỗi theo trường trước khi gửi (form tự validate – RULE.md mục 7) */
export function validateDraft(d: JobPostDraft, publish: boolean): Partial<Record<keyof JobPostDraft, string>> {
  const e: Partial<Record<keyof JobPostDraft, string>> = {};
  if (d.title.trim().length < 10) e.title = 'Tiêu đề tối thiểu 10 ký tự';
  if (!publish) return e;
  if (!d.program) e.program = 'Chọn chương trình';
  if (!d.industry) e.industry = 'Chọn ngành nghề';
  if (!d.pref) e.pref = 'Chọn nơi làm việc';
  if (!d.quantity || d.quantity < 1 || d.quantity > 500) e.quantity = 'Số lượng từ 1 đến 500';
  if (!d.gender) e.gender = 'Chọn giới tính';
  if (d.ageFrom < 16 || d.ageTo > 60 || d.ageFrom > d.ageTo) e.ageFrom = 'Độ tuổi từ 16 đến 60, "từ" không lớn hơn "đến"';
  if (!d.description.trim()) e.description = 'Nhập mô tả công việc';
  if (d.salary < 50000 || d.salary > 1000000) e.salary = 'Lương cơ bản từ 50.000 đến 1.000.000 ¥';
  if (!d.contractYears) e.contractYears = 'Chọn thời hạn hợp đồng';
  if (!d.deadline) e.deadline = 'Chọn hạn nhận hồ sơ';
  else if (new Date(`${d.deadline}T23:59:59`) < new Date()) e.deadline = 'Hạn nhận hồ sơ phải sau hôm nay';
  return e;
}
