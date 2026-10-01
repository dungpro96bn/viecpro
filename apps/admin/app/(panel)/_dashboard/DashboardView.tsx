'use client';

import { DASHBOARD_RANGES, type AdminDashboard, type DashboardRange } from '@viecpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useShell } from '@/components/layout/AdminShell';
import { IconBell, IconCalendar, IconDownload } from '@/components/ui/Icons';
import { api, ApiRequestError, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx, formatToday } from '@/lib/format';
import { RevenueCard, SystemHealth } from './FooterCards';
import { DemandByPref, LiveActivity, ModerationQueue, ReportList, VerificationList } from './Operations';
import { ApplicationsCard, FunnelCard, InsightsBanner, KpiCards } from './Overview';

const RANGE_LABEL: Record<DashboardRange, string> = { today: 'Hôm nay', '7d': '7 ngày', '30d': '30 ngày', quarter: 'Quý' };

export default function DashboardView() {
  const { can } = useAuth();
  const { badges, refreshBadges } = useShell();
  const [range, setRange] = useState<DashboardRange>('30d');
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (r: DashboardRange) => {
    try {
      setError(null);
      setData(await api<AdminDashboard>(`/admin/dashboard?range=${r}`));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Không tải được số liệu');
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  /** Sau khi duyệt / xác minh: tải lại số liệu + badge menu */
  const reload = useCallback(async () => {
    await Promise.all([load(range), refreshBadges()]);
  }, [load, range, refreshBadges]);

  const pending = badges ? badges.pendingJobs + badges.pendingVerifications + badges.openReports : 0;

  return (
    <>
      <header className="page-header">
        <span className="page-header__titles">
          <span className="page-header__meta">{formatToday(data?.generatedAt ?? null)}</span>
          <h1 className="page-header__title">Bảng điều khiển nền tảng</h1>
        </span>
        <div className="page-header__actions dash-actions">
          <div className="segmented" role="radiogroup" aria-label="Khoảng thời gian">
            {DASHBOARD_RANGES.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={range === r} className={cx('segmented__option', range === r && 'segmented__option--active')} onClick={() => setRange(r)}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          <span className="dash-actions__compare">
            <IconCalendar size={16} />
            So với kỳ trước
          </span>
          {can('data.export') && (
            <button
              type="button"
              className="btn btn--dark"
              disabled={exporting}
              onClick={() => {
                setExporting(true);
                void download(`/admin/dashboard/export?range=${range}`)
                  .catch(() => setError('Không xuất được báo cáo'))
                  .finally(() => setExporting(false));
              }}
            >
              {exporting ? <span className="spinner" /> : <IconDownload size={16} />}
              Xuất báo cáo
            </button>
          )}
          <button type="button" className="icon-btn" aria-label={pending ? `${pending} việc cần xử lý` : 'Thông báo'} title={pending ? `${pending} việc cần xử lý` : 'Không có việc tồn'}>
            <IconBell size={18} />
            {pending > 0 && <span className="icon-btn__dot" />}
          </button>
        </div>
      </header>

      <div className="page-body">
        {error && (
          <p className="alert alert--danger" role="alert">
            {error}{' '}
            <button type="button" className="dash-retry" onClick={() => void load(range)}>
              Thử lại
            </button>
          </p>
        )}

        {!data ? (
          <DashboardSkeleton />
        ) : (
          <>
            <InsightsBanner insights={data.insights} />
            <KpiCards kpis={data.kpis} />

            <div className="dash-row">
              <ApplicationsCard data={data.applicationsDaily} />
              <FunnelCard funnel={data.funnel} />
            </div>

            <div className="dash-row dash-row--top">
              <div className="dash-col">
                <ModerationQueue queue={data.moderationQueue} canModerate={can('jobs.moderate')} onChanged={reload} />
                <LiveActivity items={data.activity} />
              </div>
              <div className="dash-col">
                <VerificationList data={data.verifications} canVerify={can('employers.verify')} onChanged={reload} />
                <ReportList reports={data.reports} />
                <DemandByPref items={data.demandByPref} />
              </div>
            </div>

            <div className="dash-row dash-row--footer">
              <RevenueCard revenue={data.revenue} />
              <SystemHealth health={data.health} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dash-skeleton" aria-busy="true" aria-label="Đang tải số liệu">
      <span className="skeleton dash-skeleton__banner" />
      <div className="dash-kpis">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="skeleton dash-skeleton__kpi" />
        ))}
      </div>
      <div className="dash-row">
        <span className="skeleton dash-skeleton__chart" />
        <span className="skeleton dash-skeleton__chart" />
      </div>
    </div>
  );
}
