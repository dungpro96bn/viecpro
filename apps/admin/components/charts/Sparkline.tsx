import { cx } from '@/lib/format';
import './charts.css';

const W = 120;
const H = 34;
const PAD = 4;

/** Toạ độ đường cho chuỗi số, chuẩn hoá theo min–max (giống mẫu: y từ 30 → 4) */
export function linePoints(values: number[], width: number, height: number, pad = PAD): Array<[number, number]> {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => [i * step, height - pad - ((v - min) / span) * (height - pad * 2)]);
}

export const toPath = (pts: Array<[number, number]>) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

/** Biểu đồ đường nhỏ trong thẻ số liệu. tone="warning" cho chỉ số tăng là xấu */
export default function Sparkline({ values, tone = 'primary' }: { values: number[]; tone?: 'primary' | 'warning' }) {
  if (values.length < 2) return <span className="sparkline sparkline--empty" />;
  const pts = linePoints(values, W, H);
  const line = toPath(pts);
  return (
    <svg className={cx('sparkline', `sparkline--${tone}`)} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="sparkline__area" d={`${line} L${W} ${H} L0 ${H} Z`} />
      <path className="sparkline__line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
