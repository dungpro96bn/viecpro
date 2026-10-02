'use client';

import { IconChevronLeft, IconChevronRight } from '@/components/ui/Icons';
import { cx, formatNumber } from '@/lib/format';

/** Trang hiển thị quanh trang hiện tại: 1 2 3 … 436 */
function pages(current: number, last: number): Array<number | '…'> {
  const set = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1]! > 1) out.push('…');
    out.push(p);
  });
  return out;
}

/** Chân bảng: "Hiển thị 1–8 trong 48.216 ứng viên" + số trang */
export default function Pagination({ page, limit, total, unit, onPage }: { page: number; limit: number; total: number; unit: string; onPage: (p: number) => void }) {
  const last = Math.max(1, Math.ceil(total / limit));
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  return (
    <footer className="pager">
      <span className="pager__info">
        {total ? `Hiển thị ${formatNumber(from)}–${formatNumber(to)} trong ${formatNumber(total)} ${unit}` : `Không có ${unit}`}
      </span>
      {last > 1 && (
        <nav className="pager__pages" aria-label="Phân trang">
          <button type="button" className="pager__btn" aria-label="Trang trước" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <IconChevronLeft size={15} />
          </button>
          {pages(page, last).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="pager__gap">
                …
              </span>
            ) : (
              <button key={p} type="button" className={cx('pager__btn', p === page && 'pager__btn--on')} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
                {formatNumber(p)}
              </button>
            ),
          )}
          <button type="button" className="pager__btn" aria-label="Trang sau" disabled={page >= last} onClick={() => onPage(page + 1)}>
            <IconChevronRight size={15} />
          </button>
        </nav>
      )}
    </footer>
  );
}
