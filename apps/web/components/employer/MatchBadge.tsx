import { cx } from '@/lib/format';

/** % phù hợp: ≥ 90 xanh lá, < 70 xám, còn lại xanh dương */
export default function MatchBadge({ score, className }: { score: number | null; className?: string }) {
  if (score === null) return null;
  return <span className={cx('emp-match', score >= 90 && 'emp-match--high', score < 70 && 'emp-match--low', className)}>{score}%</span>;
}
