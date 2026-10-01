import type { ReactNode } from 'react';
import type { EmployerDashboard } from '@viecpro/shared';
import { dayMonth, decimal, sparkPoints } from '@/lib/employer';
import { cx, formatNumber } from '@/lib/format';

/* ---------- Thẻ chỉ số có đường xu hướng ---------- */
export interface Kpi {
  label: string;
  value: string;
  delta: { text: string; up: boolean; good?: boolean } | null;
  series: number[];
  note: string;
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  // Xu hướng tốt (tăng, hoặc giảm với chỉ số "càng thấp càng tốt") → xanh lá, ngược lại cam
  const good = kpi.delta ? (kpi.delta.good ?? kpi.delta.up) : true;
  return (
    <div className="dash-kpi">
      <span className="dash-kpi__head">
        <span className="dash-kpi__label">{kpi.label}</span>
        {kpi.delta && <span className={cx('dash-kpi__delta', !good && 'dash-kpi__delta--down')}>{kpi.delta.text}</span>}
      </span>
      <span className="dash-kpi__body">
        <span className="dash-kpi__value">{kpi.value}</span>
        <svg className={cx('dash-kpi__spark', !good && 'dash-kpi__spark--down')} width="96" height="36" viewBox="0 0 96 36" fill="none" aria-hidden="true">
          <polyline points={sparkPoints(kpi.series)} />
        </svg>
      </span>
      <span className="dash-kpi__note">{kpi.note}</span>
    </div>
  );
}

/* ---------- Biểu đồ hồ sơ theo ngày ---------- */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

export function DailyChart({ daily }: { daily: EmployerDashboard['daily'] }) {
  const total = daily.reduce((s, d) => s + d.count, 0);
  const max = Math.max(3, ...daily.map((d) => d.count));
  // Trục tung 3 khoảng đều, bước làm tròn "đẹp" (1, 2, 2.5, 5 × 10^n)
  const step = niceStep(max / 3);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => top - i * step);
  const labelEvery = Math.ceil(daily.length / 14);

  return (
    <div className="emp-card dash-chart">
      <div className="dash-card-head">
        <span className="dash-card-head__titles">
          <h2 className="emp-card__title">Hồ sơ ứng tuyển theo ngày</h2>
          <p className="emp-card__sub">
            {formatNumber(total)} hồ sơ trong {daily.length} ngày qua · trung bình {decimal(total / daily.length)}/ngày
          </p>
        </span>
        <span className="dash-legend">
          <span className="dash-legend__item">
            <span className="dash-legend__swatch" />
            Hồ sơ mới
          </span>
          <span className="dash-legend__item">
            <span className="dash-legend__swatch dash-legend__swatch--weekend" />
            Cuối tuần
          </span>
        </span>
      </div>
      <div className="dash-bars" role="img" aria-label={`Biểu đồ ${formatNumber(total)} hồ sơ trong ${daily.length} ngày`}>
        <span className="dash-bars__axis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t}>{formatNumber(Math.round(t))}</span>
          ))}
        </span>
        {daily.map((d, i) => (
          <span key={d.date} className="dash-bars__col">
            <span className="dash-bars__value">{d.count}</span>
            <span
              className={cx('dash-bars__bar', d.weekend && 'dash-bars__bar--weekend')}
              style={{ height: `${(d.count / top) * 100}%` }}
              title={`${dayMonth(d.date)}: ${d.count} hồ sơ`}
            />
            {i % labelEvery === 0 && <span className="dash-bars__date">{dayMonth(d.date)}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Phễu tuyển dụng ---------- */
export function Funnel({ funnel, insight }: { funnel: EmployerDashboard['funnel']; insight: ReactNode }) {
  const steps = [
    { key: 'views', label: 'Lượt xem tin', value: funnel.views, from: null, tone: 'views' },
    { key: 'applied', label: 'Ứng tuyển', value: funnel.applied, from: funnel.views, tone: 'applied' },
    { key: 'contacted', label: 'Đã liên hệ', value: funnel.contacted, from: funnel.applied, tone: 'contacted' },
    { key: 'interview', label: 'Phỏng vấn', value: funnel.interview, from: funnel.contacted, tone: 'interview' },
    { key: 'passed', label: 'Trúng tuyển', value: funnel.passed, from: funnel.interview, tone: 'passed' },
  ];
  const base = Math.max(1, funnel.views, funnel.applied);
  return (
    <div className="emp-card dash-funnel">
      <span className="dash-card-head__titles">
        <h2 className="emp-card__title">Phễu tuyển dụng</h2>
        <p className="emp-card__sub">Tỉ lệ chuyển đổi giữa các bước</p>
      </span>
      {steps.map((s) => (
        <div key={s.key} className="dash-funnel__step">
          <span className="dash-funnel__row">
            <span className="dash-funnel__label">{s.label}</span>
            <span>
              <b>{formatNumber(s.value)}</b>
              {s.from !== null && <span className="dash-funnel__rate">· {s.from ? decimal((s.value / s.from) * 100) : '0'}%</span>}
            </span>
          </span>
          <span className="dash-funnel__track">
            {/* Thang căn bậc hai để các bước nhỏ vẫn nhìn thấy được */}
            <span className={cx('dash-funnel__fill', `dash-funnel__fill--${s.tone}`)} style={{ width: `${Math.max(2, Math.sqrt(s.value / base) * 100)}%` }} />
          </span>
        </div>
      ))}
      <p className="dash-funnel__insight">{insight}</p>
    </div>
  );
}
