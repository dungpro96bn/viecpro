'use client';

import { useEffect, useState } from 'react';
import { APPLICATION_SOURCE_LABEL, type EmployerReport } from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import Select from '@/components/ui/Select';
import { apiMessage, apiRequest } from '@/lib/api';
import { formatNumber } from '@/lib/format';

const RANGES = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
];

export default function ReportsView() {
  const { account } = useEmployerAccount();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [data, setData] = useState<EmployerReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setBusy(true);
    apiRequest<EmployerReport>(`/employer/reports?range=${range}`)
      .then((report) => active && (setData(report), setError('')))
      .catch((cause: unknown) => active && setError(apiMessage(cause, 'Không tải được báo cáo.')))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [range]);

  return (
    <div className="erpt">
      <header className="emp-page-head">
        <span className="emp-page-head__titles">
          <span className="emp-page-head__eyebrow">Hiệu quả tuyển dụng</span>
          <h1 className="emp-page-head__title">Báo cáo thống kê</h1>
        </span>
        <Select className="erpt__range" aria-label="Khoảng thời gian báo cáo" value={range} onChange={(value) => setRange(value as typeof range)} options={RANGES} />
      </header>
      <p className="erpt__scope">Số liệu chỉ tính tin và hồ sơ thuộc {account.company ? account.company.shortName ?? account.company.name : 'tài khoản của bạn'}.</p>
      {error && <p className="erpt__error" role="alert">{error}</p>}
      {!data && !error && <p className="emp-state" role="status">Đang tải báo cáo…</p>}
      {data && (
        <div className="erpt__stack" aria-busy={busy}>
          <section className="erpt-kpis" aria-label="Tổng hợp">
            <Metric title="Lượt xem tin" value={formatNumber(data.totalViews)} previous={data.previousViews} />
            <Metric title="Hồ sơ ứng tuyển" value={formatNumber(data.totalApplications)} previous={data.previousApplications} />
            <article className="emp-card erpt-metric">
              <span>Tỉ lệ hồ sơ / lượt xem</span><b>{data.conversion}%</b><small>Trong {data.range} ngày gần nhất</small>
            </article>
          </section>

          <section className="emp-card erpt-card">
            <header className="erpt-card__head"><span><h2>Xu hướng theo ngày</h2><p>So sánh lượt xem và hồ sơ mới</p></span><span className="erpt__legend"><i className="erpt__dot erpt__dot--views" />Lượt xem <i className="erpt__dot erpt__dot--apps" />Hồ sơ</span></header>
            <div className="erpt-chart" style={{ gridTemplateColumns: `repeat(${data.daily.length}, minmax(3px, 1fr))` }} role="img" aria-label={`Biểu đồ ${data.range} ngày: ${formatNumber(data.totalViews)} lượt xem và ${formatNumber(data.totalApplications)} hồ sơ`}>
              {data.daily.map((day, index) => {
                const max = Math.max(1, ...data.daily.map((item) => Math.max(item.views, item.applications)));
                const label = data.range === '7' || index % (data.range === '30' ? 3 : 9) === 0 || index === data.daily.length - 1;
                return <span key={day.date} className="erpt-chart__day" title={`${day.date}: ${day.views} lượt xem · ${day.applications} hồ sơ`}>
                  <span className="erpt-chart__bars"><i className="erpt-chart__bar erpt-chart__bar--views" style={{ height: `${Math.max(2, (day.views / max) * 100)}%` }} /><i className="erpt-chart__bar erpt-chart__bar--apps" style={{ height: `${Math.max(2, (day.applications / max) * 100)}%` }} /></span>
                  <small>{label ? day.date.slice(5) : ''}</small>
                </span>;
              })}
            </div>
          </section>

          <div className="erpt__grid">
            <section className="emp-card erpt-card">
              <header className="erpt-card__head"><span><h2>Tin hiệu quả nhất</h2><p>Xếp theo số hồ sơ nhận được</p></span></header>
              {data.jobs.length ? <div className="erpt-table-wrap"><table className="erpt-table"><thead><tr><th>Tin tuyển dụng</th><th>Lượt xem</th><th>Hồ sơ</th><th>Chuyển đổi</th></tr></thead><tbody>{data.jobs.map((job) => <tr key={job.id}><th scope="row"><b>{job.title}</b><small>{job.code}</small></th><td>{formatNumber(job.views)}</td><td>{formatNumber(job.applications)}</td><td>{job.conversion}%</td></tr>)}</tbody></table></div> : <p className="erpt__empty">Chưa có hồ sơ ứng tuyển trong khoảng thời gian này.</p>}
            </section>
            <section className="emp-card erpt-card">
              <header className="erpt-card__head"><span><h2>Nguồn ứng tuyển</h2><p>Hồ sơ nhận trong kỳ</p></span></header>
              {data.sources.length ? <ul className="erpt-sources">{data.sources.map((source) => <li key={source.source}><span>{APPLICATION_SOURCE_LABEL[source.source]}</span><b>{formatNumber(source.count)}</b></li>)}</ul> : <p className="erpt__empty">Chưa có dữ liệu nguồn.</p>}
            </section>
          </div>
          <section className="emp-card erpt-card">
            <header className="erpt-card__head"><span><h2>Phễu tuyển dụng</h2><p>Trạng thái hiện tại của hồ sơ nhận trong kỳ</p></span></header>
            <div className="erpt-funnel">{[['Ứng tuyển', data.funnel.applied], ['Đã liên hệ', data.funnel.contacted], ['Phỏng vấn', data.funnel.interview], ['Trúng tuyển', data.funnel.passed], ['Đã xuất cảnh', data.funnel.departed]].map(([label, count]) => <div key={label} className="erpt-funnel__step"><span>{label}</span><b>{formatNumber(Number(count))}</b></div>)}</div>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, previous }: { title: string; value: string; previous: number }) {
  return <article className="emp-card erpt-metric"><span>{title}</span><b>{value}</b><small>Kỳ trước: {formatNumber(previous)}</small></article>;
}
