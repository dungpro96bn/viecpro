'use client';

import type { ReactNode } from 'react';
import { PROGRAM_LABEL, estimateNetIncome, type SavedJobItem } from '@viecpro/shared';
import { cx } from '@/lib/format';
import { requirementText, yen } from '@/lib/seeker';

const DAY = 86400_000;
const daysLeft = (iso: string | null) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / DAY)) : null);

interface Row {
  label: string;
  cell: (j: SavedJobItem) => ReactNode;
  /** Giá trị để chọn ô tốt nhất (cao hơn là tốt hơn); không có → không tô */
  score?: (j: SavedJobItem) => number | null;
}

const ROWS: Row[] = [
  { label: 'Lương cơ bản', cell: (j) => yen(j.salary), score: (j) => j.salary },
  { label: 'Thực lĩnh ước tính', cell: (j) => `≈ ${yen(estimateNetIncome(j.salary))}`, score: (j) => j.salary },
  { label: 'Chi phí xuất cảnh', cell: (j) => (j.feeUsd === 0 ? 'Miễn phí' : j.feeUsd ? `${j.feeUsd.toLocaleString('vi-VN')} USD` : '—'), score: (j) => (j.feeUsd === null ? null : -j.feeUsd) },
  { label: 'Thời hạn hợp đồng', cell: (j) => (j.contractYears ? `${j.contractYears} năm` : '—'), score: (j) => j.contractYears },
  { label: 'Chương trình', cell: (j) => PROGRAM_LABEL[j.program] },
  { label: 'Yêu cầu', cell: requirementText },
  { label: 'Mức phù hợp', cell: (j) => `${j.matchScore ?? 0}%`, score: (j) => j.matchScore ?? 0 },
  {
    label: 'Hạn nộp hồ sơ',
    cell: (j) => {
      const d = daysLeft(j.deadline);
      return d === null ? 'Đang nhận' : d === 0 ? 'Hôm nay' : `Còn ${d} ngày`;
    },
    score: (j) => daysLeft(j.deadline) ?? 365,
  },
];

/** So sánh 2 – 3 việc đã lưu, ô xanh là lựa chọn tốt hơn ở từng tiêu chí (design 20) */
export default function CompareTable({ jobs, onClear }: { jobs: SavedJobItem[]; onClear: () => void }) {
  return (
    <section className="sv-cmp" aria-labelledby="sv-cmp-title">
      <div className="sv-cmp__head">
        <span>
          <h2 id="sv-cmp-title">So sánh {jobs.length} việc làm</h2>
          <small>Ô màu xanh là lựa chọn tốt hơn ở từng tiêu chí.</small>
        </span>
        <button type="button" className="sv-btn sv-btn--outline sv-cmp__clear" onClick={onClear}>
          Bỏ chọn tất cả
        </button>
      </div>
      <div className="sv-cmp__scroll">
        <table className={cx('sv-cmp__table', jobs.length === 3 && 'sv-cmp__table--3')}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Tiêu chí</span>
              </th>
              {jobs.map((j) => (
                <th key={j.id} scope="col">
                  <span className="sv-cmp__job">
                    <img src={j.imageUrl} alt="" />
                    {j.title}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const scores = jobs.map((j) => r.score?.(j) ?? null);
              const valid = scores.filter((s): s is number => s !== null);
              const best = valid.length > 1 && new Set(valid).size > 1 ? Math.max(...valid) : null;
              return (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {jobs.map((j, i) => (
                    <td key={j.id}>
                      <span className={cx(best !== null && scores[i] === best && 'sv-cmp__best')}>{r.cell(j)}</span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
