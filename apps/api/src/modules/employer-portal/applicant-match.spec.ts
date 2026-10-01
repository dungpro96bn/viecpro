import { scoreApplicant, type MatchApplicant, type MatchJobRequirement } from './applicant-match.js';

const now = new Date('2026-10-01T10:00:00');
const job: MatchJobRequirement = { birthYearFrom: 1996, birthYearTo: 2008, gender: 'nu', jlptRequired: null };
const lan: MatchApplicant = { birthYear: 1999, gender: 'nu', jlpt: null, passport: 'has', tags: ['Khéo tay', 'Có hộ chiếu'] };

describe('scoreApplicant', () => {
  it('đúng tuổi, đúng giới tính, có kỹ năng → điểm cao, lý do đạt đứng trước', () => {
    const { score, reasons } = scoreApplicant(lan, job, now);
    expect(score).toBe(93);
    expect(reasons[0]).toEqual({ ok: true, text: 'Đúng độ tuổi của đơn (18–30)' });
    expect(reasons.at(-1)).toEqual({ ok: false, text: 'Chưa có chứng chỉ tiếng Nhật' });
  });

  it('sai giới tính và quá tuổi → điểm thấp', () => {
    const { score, reasons } = scoreApplicant({ ...lan, gender: 'nam', birthYear: 1990, tags: [] }, job, now);
    expect(score).toBeLessThan(40);
    expect(reasons.filter((r) => !r.ok).map((r) => r.text)).toContain('Khác giới tính đơn tuyển');
  });

  it('đơn yêu cầu N3: có N4 vẫn chưa đạt', () => {
    const { reasons } = scoreApplicant({ ...lan, jlpt: 'N4' }, { ...job, jlptRequired: 'N3' }, now);
    expect(reasons).toContainEqual({ ok: false, text: 'Tiếng Nhật N4, đơn cần N3' });
  });

  it('điểm không vượt quá 99', () => {
    const { score } = scoreApplicant({ ...lan, jlpt: 'N2', tags: ['Khéo tay', 'Thị lực tốt', 'Không hình xăm'] }, { ...job, jlptRequired: 'N3' }, now);
    expect(score).toBeLessThanOrEqual(99);
  });
});
