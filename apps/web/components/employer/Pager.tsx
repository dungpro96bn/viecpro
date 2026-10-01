import { IconChevronLeft, IconChevronRight } from '@/components/ui/Icons';
import { cx, formatNumber } from '@/lib/format';

/** Số trang hiển thị: 1 2 3 4 5 … N */
function pagesOf(current: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', count];
  if (current >= count - 3) return [1, 'gap', count - 4, count - 3, count - 2, count - 1, count];
  return [1, 'gap', current - 1, current, current + 1, 'gap', count];
}

/** Chân bảng: "Hiển thị x / y …" + nút trang */
export default function Pager({ page, perPage, total, shown, noun, onPage }: { page: number; perPage: number; total: number; shown: number; noun: string; onPage: (p: number) => void }) {
  const count = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="emp-pager">
      <span>
        Hiển thị {formatNumber(shown)} trong {formatNumber(total)} {noun}
      </span>
      <span className="emp-pager__btns">
        <button type="button" className="emp-pager__btn" aria-label="Trang trước" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <IconChevronLeft size={14} className="icon--w22" />
        </button>
        {pagesOf(page, count).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="emp-pager__gap">
              …
            </span>
          ) : (
            <button key={p} type="button" className={cx('emp-pager__btn', p === page && 'emp-pager__btn--active')} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
              {p}
            </button>
          ),
        )}
        <button type="button" className="emp-pager__btn" aria-label="Trang sau" disabled={page >= count} onClick={() => onPage(page + 1)}>
          <IconChevronRight size={14} className="icon--w22" />
        </button>
      </span>
    </div>
  );
}
