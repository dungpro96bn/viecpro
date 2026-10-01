import type { Gender, Program } from '@viecpro/shared';

export interface MatchProfile {
  birthYear: number | null;
  gender: Gender | null;
  programs: Program[];
  industries: string[];
  prefs: string[];
}

export interface MatchJob {
  birthYearFrom: number;
  birthYearTo: number;
  gender: 'nam' | 'nu' | 'both';
  program: Program;
  industry: string;
  pref: string;
  tags: string[];
}

/**
 * Điểm phù hợp 0–100 giữa hồ sơ ứng viên và đơn hàng ("Phù hợp 96%" trên trang tài khoản).
 * Tuổi và giới tính là điều kiện cứng: không khớp thì điểm thấp.
 */
export function matchJob(profile: MatchProfile, job: MatchJob): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 40;

  if (profile.birthYear && profile.birthYear >= job.birthYearFrom && profile.birthYear <= job.birthYearTo) {
    score += 20;
    reasons.push('Hợp tuổi');
  } else if (profile.birthYear) {
    score -= 25;
  }

  if (profile.gender && (job.gender === 'both' || job.gender === profile.gender)) {
    score += 10;
    if (job.gender !== 'both') reasons.push(job.gender === 'nu' ? 'Tuyển nữ' : 'Tuyển nam');
  } else if (profile.gender) {
    score -= 30;
  }

  if (profile.industries.includes(job.industry)) {
    score += 14;
    reasons.push('Đúng ngành');
  }
  if (profile.programs.includes(job.program)) score += 10;
  if (profile.prefs.includes(job.pref)) {
    score += 6;
    reasons.push('Đúng tỉnh');
  }
  for (const tag of ['Lương cao', 'Phí thấp', 'Đơn miễn phí']) {
    if (job.tags.includes(tag)) reasons.push(tag);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 2) };
}
