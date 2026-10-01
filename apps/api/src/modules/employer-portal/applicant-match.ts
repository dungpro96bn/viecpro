/** Chấm % phù hợp giữa hồ sơ ứng tuyển và đơn hàng + lý do hiển thị cho NTD (thuần, có unit test) */

export interface MatchApplicant {
  birthYear: number;
  gender: 'nam' | 'nu';
  jlpt: string | null;
  passport: string | null;
  tags: string[];
}

export interface MatchJobRequirement {
  birthYearFrom: number;
  birthYearTo: number;
  gender: 'nam' | 'nu' | 'both';
  /** N5 | N4 | N3 – null là không yêu cầu */
  jlptRequired: string | null;
}

export interface MatchReason {
  ok: boolean;
  text: string;
}

const JLPT_RANK: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
/** Nhãn kỹ năng được cộng điểm (khớp các kỹ năng NTD hay yêu cầu) */
const POSITIVE_TAGS = ['Khéo tay', 'Thị lực tốt', 'Không hình xăm', 'Làm ca đêm được', 'Đã khám SK', 'Có hộ chiếu'];

export function scoreApplicant(a: MatchApplicant, job: MatchJobRequirement, now = new Date()): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let score = 50;
  const year = now.getFullYear();
  const ageRange = `${year - job.birthYearTo}–${year - job.birthYearFrom}`;

  if (a.birthYear >= job.birthYearFrom && a.birthYear <= job.birthYearTo) {
    score += 20;
    reasons.push({ ok: true, text: `Đúng độ tuổi của đơn (${ageRange})` });
  } else {
    score -= 25;
    reasons.push({ ok: false, text: `Ngoài độ tuổi của đơn (${ageRange})` });
  }

  if (job.gender === 'both' || job.gender === a.gender) {
    score += 15;
    reasons.push({ ok: true, text: job.gender === 'both' ? 'Đơn tuyển cả nam và nữ' : 'Đúng giới tính đơn tuyển' });
  } else {
    score -= 30;
    reasons.push({ ok: false, text: 'Khác giới tính đơn tuyển' });
  }

  const have = a.jlpt ? (JLPT_RANK[a.jlpt] ?? 0) : 0;
  if (job.jlptRequired) {
    const need = JLPT_RANK[job.jlptRequired] ?? 0;
    if (have >= need) {
      score += 10;
      reasons.push({ ok: true, text: `Đạt tiếng Nhật ${a.jlpt} (đơn cần ${job.jlptRequired})` });
    } else {
      score -= 10;
      reasons.push({ ok: false, text: a.jlpt ? `Tiếng Nhật ${a.jlpt}, đơn cần ${job.jlptRequired}` : `Cần tiếng Nhật ${job.jlptRequired}` });
    }
  } else if (have) {
    score += 5;
    reasons.push({ ok: true, text: `Có tiếng Nhật ${a.jlpt}` });
  } else {
    reasons.push({ ok: false, text: 'Chưa có chứng chỉ tiếng Nhật' });
  }

  for (const tag of a.tags.filter((t) => POSITIVE_TAGS.includes(t)).slice(0, 2)) {
    score += 4;
    reasons.push({ ok: true, text: tag });
  }
  if (a.passport === 'has' && !a.tags.includes('Có hộ chiếu')) {
    score += 4;
    reasons.push({ ok: true, text: 'Đã có hộ chiếu' });
  }

  // Lý do đạt lên trước, chưa đạt xuống cuối
  reasons.sort((x, y) => Number(y.ok) - Number(x.ok));
  return { score: Math.max(0, Math.min(99, score)), reasons };
}
