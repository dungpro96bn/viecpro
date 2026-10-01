import { cx } from '@/lib/format';
import './ui.css';

interface StarsProps {
  rating: number;
  size?: number;
  /** "light" dùng trên nền xanh đậm (popup ứng tuyển) */
  tone?: 'default' | 'light';
  className?: string;
}

/** Dãy 5 sao đánh giá. Sao được tô khi rating ≥ vị trí − 0.25 */
export default function Stars({ rating, size = 13, tone = 'default', className }: StarsProps) {
  return (
    <span className={cx('stars', tone === 'light' && 'stars--light', className)} aria-label={`Đánh giá ${rating.toFixed(1)} trên 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={cx('stars__star', rating >= i - 0.25 && 'stars__star--on')}
        >
          <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
        </svg>
      ))}
    </span>
  );
}
