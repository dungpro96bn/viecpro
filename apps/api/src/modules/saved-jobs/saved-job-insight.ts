import { JLPT_LEVELS, type Gender, type SavedJobItem } from '@viecpro/shared';

const DAY = 86400_000;

export interface InsightProfile {
  birthYear: number | null;
  gender: Gender | null;
  industries: string[];
  /** Chứng chỉ, hoặc trình độ đang học */
  jlpt: string | null;
  jlptLearning: string | null;
}

export interface InsightJob {
  birthYearFrom: number;
  birthYearTo: number;
  gender: 'nam' | 'nu' | 'both';
  industry: string;
  jlptRequired: string | null;
  feeUsd: number | null;
  quantity: number;
  deadline: Date | null;
}

/** N5 = 0 … N1 = 4; chưa có = -1 */
const jlptRank = (l: string | null) => (l ? JLPT_LEVELS.indexOf(l as (typeof JLPT_LEVELS)[number]) : -1);

export function daysLeft(deadline: Date | null, now: Date): number | null {
  return deadline ? Math.ceil((deadline.getTime() - now.getTime()) / DAY) : null;
}

/**
 * Đánh giá một việc đã lưu so với hồ sơ: đủ điều kiện cứng (tuổi, giới tính) không,
 * câu giải thích ngắn và nhãn nổi bật trên ảnh (design 20).
 */
export function savedJobInsight(p: InsightProfile, job: InsightJob, passed: number, now = new Date()): Pick<SavedJobItem, 'eligible' | 'matchNote' | 'highlight'> {
  const age = p.birthYear ? now.getFullYear() - p.birthYear : null;
  const ageOk = !p.birthYear || (p.birthYear >= job.birthYearFrom && p.birthYear <= job.birthYearTo);
  const genderOk = !p.gender || job.gender === 'both' || job.gender === p.gender;
  const industryOk = p.industries.includes(job.industry);
  const needJlpt = jlptRank(job.jlptRequired);
  const haveJlpt = Math.max(jlptRank(p.jlpt), -1);
  const genderLabel = job.gender === 'nam' ? 'nam' : 'nữ';

  let matchNote: SavedJobItem['matchNote'];
  if (!genderOk) matchNote = { ok: false, text: `Đơn chỉ tuyển ${genderLabel} – không khớp hồ sơ của bạn` };
  else if (!ageOk) matchNote = { ok: false, text: `Đơn tuyển ${now.getFullYear() - job.birthYearTo}–${now.getFullYear() - job.birthYearFrom} tuổi – bạn ${age} tuổi` };
  else if (needJlpt > haveJlpt) matchNote = { ok: false, text: `Cần tiếng Nhật ${job.jlptRequired}${p.jlptLearning ? ` – bạn đang học ${p.jlptLearning}` : ''}` };
  else {
    const parts = [job.gender !== 'both' && 'giới tính', 'độ tuổi'].filter(Boolean).join(', ');
    matchNote = { ok: true, text: industryOk ? `Khớp ${parts} và ngành bạn mong muốn` : `Khớp ${parts}, khác ngành mong muốn` };
  }

  const left = daysLeft(job.deadline, now);
  const remaining = job.quantity - passed;
  let highlight: SavedJobItem['highlight'] = null;
  if (left !== null && left >= 0 && left <= 7) highlight = { kind: 'expiring', text: left === 0 ? 'Hết hạn hôm nay' : `Hết hạn sau ${left} ngày` };
  else if (job.gender !== 'both') highlight = { kind: 'gender', text: `Chỉ tuyển ${genderLabel}` };
  else if (job.feeUsd === 0) highlight = { kind: 'free', text: 'Đơn miễn phí' };
  else if (remaining > 0 && remaining <= job.quantity / 2) highlight = { kind: 'quota', text: `Còn ${remaining}/${job.quantity} chỉ tiêu` };

  return { eligible: genderOk && ageOk, matchNote, highlight };
}
