'use client';

import type { AdminDashboard, DashboardInsight, KpiCard } from '@viecpro/shared';
import Link from 'next/link';
import AreaChart from '@/components/charts/AreaChart';
import Sparkline from '@/components/charts/Sparkline';
import { IconArrowUp, IconChevronRight, IconClock, IconFlag, IconSparkle } from '@/components/ui/Icons';
import { cx, formatCompact, formatDelta, formatNumber } from '@/lib/format';

const INSIGHT_ICON = { warning: IconClock, danger: IconFlag, success: IconArrowUp } as const;

/** Dải "Trợ lý vận hành – 3 điều cần chú ý" */
export function InsightsBanner({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section className="insights" aria-labelledby="insights-title">
      <span className="insights__bubble" />
      <div className="insights__intro">
        <span className="insights__eyebrow">
          <IconSparkle size={16} />
          TRỢ LÝ VẬN HÀNH
        </span>
        <h2 id="insights-title" className="insights__title">
          {insights.length} điều cần chú ý hôm nay
        </h2>
        <p className="insights__lead">Tổng hợp tự động từ hàng chờ, báo cáo vi phạm và số liệu ứng tuyển gần nhất.</p>
      </div>
      <div className="insights__list">
        {insights.map((i) => {
          const Icon = INSIGHT_ICON[i.tone];
          return (
            <article key={i.title} className="insight">
              <span className="insight__head">
                <span className={cx('insight__icon', `insight__icon--${i.tone}`)}>
                  <Icon size={14} className="icon--w22" />
                </span>
                <b className="insight__title">{i.title}</b>
              </span>
              <p className="insight__body">{i.body}</p>
              <Link href={i.action.href} className="insight__action">
                {i.action.label}
                <IconChevronRight size={13} className="icon--w24" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function kpiValue(k: KpiCard) {
  if (k.value === null) return '—';
  if (k.unit === 'minutes') return `${formatNumber(k.value)} phút`;
  if (k.unit === 'vnd') return `${formatCompact(k.value)} ₫`;
  return formatNumber(k.value);
}

function Trend({ delta, unit, inverse }: { delta: number | null; unit?: KpiCard['unit']; inverse?: boolean }) {
  if (delta === null) return <span className="trend trend--flat">—</span>;
  const good = inverse ? delta <= 0 : delta >= 0;
  return <span className={cx('trend', delta === 0 ? 'trend--flat' : good ? 'trend--up' : 'trend--down')}>{formatDelta(delta, unit === 'minutes' ? ' phút' : '%')}</span>;
}

export function KpiCards({ kpis }: { kpis: KpiCard[] }) {
  return (
    <div className="dash-kpis">
      {kpis.map((k) => (
        <article key={k.key} className={cx('kpi', k.value === null && 'kpi--missing')}>
          <span className="kpi__head">
            <span className="kpi__label">{k.label}</span>
            <Trend delta={k.delta} unit={k.unit} inverse={k.inverse} />
          </span>
          <b className="kpi__value">{kpiValue(k)}</b>
          <Sparkline values={k.series} tone={k.inverse ? 'warning' : 'primary'} />
          <span className="kpi__note">{k.note ?? ' '}</span>
        </article>
      ))}
    </div>
  );
}

export function ApplicationsCard({ data }: { data: AdminDashboard['applicationsDaily'] }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <span className="panel__titles">
          <h2 className="panel__title">Hồ sơ ứng tuyển mỗi ngày</h2>
          <span className="panel__subtitle">{data.days.length} ngày gần nhất · rê chuột để xem từng ngày</span>
        </span>
        <span className="chart-total">
          <b className="chart-total__value">{formatNumber(data.total)}</b>
          {data.delta !== null && <span className={cx('chart-total__delta', data.delta < 0 && 'chart-total__delta--down')}>{formatDelta(data.delta)} so với kỳ trước</span>}
        </span>
      </div>
      <AreaChart points={data.days} unit="hồ sơ" />
      <div className="tile-grid">
        <span className="stat-tile">
          <span className="stat-tile__label">Trung bình / ngày</span>
          <b className="stat-tile__value">{formatNumber(data.average)}</b>
        </span>
        <span className="stat-tile">
          <span className="stat-tile__label">Cao nhất</span>
          <b className="stat-tile__value">{formatNumber(data.max)}</b>
        </span>
        <span className="stat-tile">
          <span className="stat-tile__label">Thấp nhất</span>
          <b className="stat-tile__value">{formatNumber(data.min)}</b>
        </span>
        <span className="stat-tile">
          <span className="stat-tile__label">Ứng tuyển 1 chạm</span>
          <b className="stat-tile__value">{data.oneTapRate === null ? '—' : `${data.oneTapRate}%`}</b>
        </span>
      </div>
    </section>
  );
}

/** Phễu chuyển đổi – bước chưa đo được (cần module analytics / theo dõi xuất cảnh) hiện "Chưa đo" */
export function FunnelCard({ funnel }: { funnel: AdminDashboard['funnel'] }) {
  const max = Math.max(1, ...funnel.map((f) => f.value ?? 0));
  // Điểm nghẽn: bước giảm mạnh nhất giữa 2 bước đều có số liệu
  let worst: { from: string; to: string; drop: number } | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const a = funnel[i - 1]!;
    const b = funnel[i]!;
    if (a.value && b.value !== null) {
      const drop = 1 - b.value / a.value;
      if (!worst || drop > worst.drop) worst = { from: a.label, to: b.label, drop };
    }
  }

  return (
    <section className="panel">
      <span className="panel__titles">
        <h2 className="panel__title">Phễu chuyển đổi</h2>
        <span className="panel__subtitle">Từ lượt xem tin đến trúng tuyển</span>
      </span>
      <ol className="funnel">
        {funnel.map((f, i) => {
          const prev = funnel[i - 1]?.value;
          const rate = f.value !== null && prev ? Math.round((f.value / prev) * 100) : null;
          return (
            <li key={f.label} className="funnel__step">
              <span className="funnel__row">
                <span className="funnel__label">{f.label}</span>
                <span>
                  <b>{f.value === null ? 'Chưa đo' : formatCompact(f.value)}</b>
                  {rate !== null && <span className="funnel__rate"> · {rate}%</span>}
                </span>
              </span>
              <span className="funnel__track">
                {f.value !== null && <span className={`funnel__bar funnel__bar--${i + 1}`} style={{ width: `${Math.max(2, (f.value / max) * 100)}%` }} />}
              </span>
            </li>
          );
        })}
      </ol>
      {worst && (
        <p className="funnel__note">
          <b>Điểm nghẽn:</b> {Math.round(worst.drop * 100)}% dừng lại giữa “{worst.from.toLowerCase()}” và “{worst.to.toLowerCase()}”.
        </p>
      )}
    </section>
  );
}
