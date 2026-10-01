'use client';

import { useId, useState, type MouseEvent } from 'react';
import { formatNumber, shortDate } from '@/lib/format';
import { linePoints, toPath } from './Sparkline';
import './charts.css';

const W = 700;
const H = 230;
const BASE = 210;
const GRID = [0, 70, 140, 210];

interface Point {
  date: string;
  count: number;
}

/** Biểu đồ vùng theo ngày, rê chuột để xem từng ngày (mặc định chọn ngày cuối) */
export default function AreaChart({ points, unit }: { points: Point[]; unit: string }) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return <div className="area-chart area-chart--empty">Chưa đủ dữ liệu để vẽ biểu đồ</div>;

  const pts = linePoints(
    points.map((p) => p.count),
    W,
    BASE,
    16,
  );
  const line = toPath(pts);
  const index = active ?? points.length - 1;
  const [x, y] = pts[index]!;
  const point = points[index]!;
  const leftPct = (x / W) * 100;
  const topPx = (y / H) * H;
  // Nhãn trục X: 6 mốc rải đều
  const ticks = Array.from(new Set([0, 0.2, 0.4, 0.6, 0.8, 1].map((r) => Math.round(r * (points.length - 1)))));

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <div className="area-chart">
      <div className="area-chart__plot">
        <svg className="area-chart__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setActive(null)} role="img" aria-label={`Biểu đồ ${unit} theo ngày`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="area-chart__stop-top" />
              <stop offset="1" className="area-chart__stop-bottom" />
            </linearGradient>
          </defs>
          {GRID.map((g) => (
            <line key={g} className="area-chart__grid" x1="0" x2={W} y1={g} y2={g} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line} L${W} ${BASE} L0 ${BASE} Z`} fill={`url(#${gradientId})`} />
          <path className="area-chart__line" d={line} vectorEffect="non-scaling-stroke" />
          <line className="area-chart__cursor" x1={x} x2={x} y1="0" y2={BASE} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Toạ độ điểm và tooltip là giá trị tính lúc chạy (ngoại lệ inline style – RULE.md 4.1) */}
        <span className="area-chart__dot" style={{ left: `calc(${leftPct}% - 6px)`, top: topPx - 6 }} />
        <span className={leftPct > 70 ? 'area-chart__tip area-chart__tip--left' : 'area-chart__tip'} style={{ left: `${leftPct}%`, top: Math.max(0, topPx - 58) }}>
          <span className="area-chart__tip-date">{shortDate(point.date)}</span>
          <b className="area-chart__tip-value">
            {formatNumber(point.count)} {unit}
          </b>
        </span>
      </div>
      <div className="area-chart__axis">
        {ticks.map((i) => (
          <span key={i}>{shortDate(points[i]!.date)}</span>
        ))}
      </div>
    </div>
  );
}
