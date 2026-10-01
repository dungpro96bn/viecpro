import type { AdminDashboard } from '@viecpro/shared';
import Donut from '@/components/charts/Donut';
import { IconAlert, IconCheck } from '@/components/ui/Icons';
import { cx, formatCompact, formatDuration, formatNumber } from '@/lib/format';

/** Doanh thu theo nguồn – hiện trạng thái trống khi chưa tích hợp module thanh toán */
export function RevenueCard({ revenue }: { revenue: AdminDashboard['revenue'] }) {
  const total = revenue?.total ?? 0;
  return (
    <section className="panel">
      <span className="panel__titles">
        <h2 className="panel__title">Doanh thu theo nguồn</h2>
        <span className="panel__subtitle">{revenue ? `Tổng ${formatCompact(total)} ₫` : 'Chưa tích hợp module Gói & doanh thu'}</span>
      </span>
      <div className="revenue">
        <Donut parts={revenue ? revenue.sources.map((s) => s.value) : []} value={revenue ? formatCompact(total) : '—'} unit="VNĐ" />
        {revenue ? (
          <ul className="revenue__legend">
            {revenue.sources.map((s, i) => (
              <li key={s.label} className="revenue__item">
                <span className={`revenue__swatch revenue__swatch--c${i + 1}`} />
                <span className="revenue__label">{s.label}</span>
                <b>{formatCompact(s.value)}</b>
                <span className="revenue__pct">{Math.round((s.value / (total || 1)) * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty revenue__empty">
            Số liệu sẽ hiển thị khi bật thanh toán gói đăng tin.
            <br />
            Hiện chưa có giao dịch nào được ghi nhận.
          </p>
        )}
      </div>
    </section>
  );
}

export function SystemHealth({ health }: { health: AdminDashboard['health'] }) {
  const ok = health.status === 'ok';
  const tiles = [
    { label: 'Độ trễ database', value: `${health.dbLatencyMs} ms`, good: health.dbLatencyMs < 50, note: health.dbLatencyMs < 50 ? 'Tốt' : 'Chậm hơn thường lệ' },
    { label: 'API đã chạy liên tục', value: formatDuration(health.uptimeSeconds), good: true, note: 'Kể từ lần khởi động gần nhất' },
    { label: 'OTP đã gửi 24 giờ', value: formatNumber(health.otpSent24h), good: true, note: 'Zalo / SMS' },
    { label: 'Hàng đợi email', value: '—', good: null, note: 'Chưa tích hợp' },
  ];
  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Sức khoẻ hệ thống</h2>
        <span className={cx('health__status', !ok && 'health__status--bad')}>
          <span className="health__dot" />
          {ok ? 'Ổn định' : 'Chậm'}
        </span>
      </div>
      <div className="health">
        {tiles.map((t) => (
          <span key={t.label} className="health__tile">
            <span className="stat-tile__label">{t.label}</span>
            <b className="health__value">{t.value}</b>
            <span className={cx('health__note', t.good === false && 'health__note--warn', t.good === null && 'health__note--muted')}>
              {t.good === false ? <IconAlert size={12} className="icon--w26" /> : t.good ? <IconCheck size={12} className="icon--w26" /> : null}
              {t.note}
            </span>
          </span>
        ))}
      </div>
      <span className="health__version">
        Phiên bản API <b>v{health.version}</b>
      </span>
    </section>
  );
}
