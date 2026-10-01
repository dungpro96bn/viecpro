'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { EMPLOYER_RANGES, type EmployerDashboard as Dashboard, type EmployerPartnerItem, type EmployerRange } from '@viecpro/shared';
import ApplicantAvatar from '@/components/employer/ApplicantAvatar';
import ContactButtons from '@/components/employer/ContactButtons';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import MatchBadge from '@/components/employer/MatchBadge';
import { IconBoltLine, IconBuilding, IconCheck, IconClock, IconExclaim, IconLink, IconTrendUp } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import {
  absoluteDelta,
  compactNumber,
  dayMonth,
  daysUntil,
  decimal,
  greeting,
  hourMinute,
  longDate,
  percentDelta,
  shortName,
  timeAgo,
} from '@/lib/employer';
import { cx, formatNumber } from '@/lib/format';
import { DailyChart, Funnel, KpiCard, type Kpi } from './DashboardCharts';

const RANGE_LABEL: Record<EmployerRange, string> = { '7': '7 ngày', '14': '14 ngày', '30': '30 ngày' };
const GENDER_SHORT = { nam: 'Nam', nu: 'Nữ' } as const;

/** Trang tổng quan khu NTD – doanh nghiệp (design 10) và cá nhân (design 11) */
export default function EmployerDashboard() {
  const { account, refresh } = useEmployerAccount();
  const [range, setRange] = useState<EmployerRange>('14');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    apiRequest<Dashboard>(`/employer/dashboard?range=${range}`)
      .then((d) => active && setData(d))
      .catch((e: unknown) => active && setError(apiMessage(e, 'Không tải được số liệu tổng quan.')));
    return () => {
      active = false;
    };
  }, [range]);

  const company = account.kind === 'company';
  const kpis = data ? (company ? companyKpis(data, account.plan?.name ?? 'gói') : individualKpis(data)) : [];

  return (
    <div className="dash">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <span className="emp-page-head__eyebrow">{longDate()}</span>
          <h1 className="emp-page-head__title">
            {greeting()}, {shortName(account.user.name)}
          </h1>
        </span>
        <div className="emp-segment" role="radiogroup" aria-label="Khoảng thời gian">
          {EMPLOYER_RANGES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={range === r} className={cx('emp-segment__btn', range === r && 'emp-segment__btn--active')} onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="dash-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="emp-state" role="status">
          Đang tải số liệu…
        </p>
      )}

      {data && (
        <div className="dash__stack">
          {company ? <OverdueBanner count={data.overdueApplicants} /> : <IndividualTop data={data} onRenewed={refresh} />}

          <div className="dash-kpis">
            {kpis.map((k) => (
              <KpiCard key={k.label} kpi={k} />
            ))}
          </div>

          <div className="dash-grid">
            <DailyChart daily={data.daily} />
            <Funnel funnel={data.funnel} insight={funnelInsight(data, company)} />
          </div>

          <div className="dash-grid">
            <LatestApplicants data={data} />
            <div className="dash__side">
              <TodayInterviews data={data} />
              {company ? <Attention data={data} onChanged={refresh} /> : <Partners partners={data.partners} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Chỉ số ---------- */
function companyKpis(d: Dashboard, planName: string): Kpi[] {
  const fastDiff = d.fastResponse.value - d.fastResponse.previous;
  return [
    { label: 'Hồ sơ mới', value: formatNumber(d.applications.value), delta: percentDelta(d.applications.value, d.applications.previous), series: d.applications.series, note: d.applications.topJob ? `Nhiều nhất: ${d.applications.topJob}` : 'Chưa có hồ sơ trong kỳ' },
    { label: 'Tin đang hiển thị', value: formatNumber(d.visibleJobs.value), delta: d.visibleJobs.added ? absoluteDelta(d.visibleJobs.added) : null, series: d.visibleJobs.series, note: `${d.visibleJobs.expiringSoon} tin sắp hết hạn trong 7 ngày` },
    { label: 'Phản hồi trong 30 phút', value: `${d.fastResponse.value}%`, delta: d.fastResponse.previous ? absoluteDelta(fastDiff, '%') : null, series: d.fastResponse.series, note: `Mục tiêu của ${planName}: ${d.fastResponse.target}%` },
    { label: 'Lượt xem tin', value: compactNumber(d.views.value), delta: percentDelta(d.views.value, d.views.previous), series: d.views.series, note: 'Đẩy tin để tăng hiển thị' },
  ];
}

function individualKpis(d: Dashboard): Kpi[] {
  const minutes = d.responseMinutes;
  const faster = minutes.value !== null && minutes.previous !== null ? minutes.value - minutes.previous : null;
  return [
    { label: 'Hồ sơ mới', value: formatNumber(d.applications.value), delta: percentDelta(d.applications.value, d.applications.previous), series: d.applications.series, note: d.applications.topJob ? `Nhiều nhất: ${d.applications.topJob}` : 'Chưa có hồ sơ trong kỳ' },
    {
      label: 'Thời gian phản hồi',
      value: minutes.value === null ? '—' : `~${minutes.value} phút`,
      // Càng ít phút càng tốt: giảm là xu hướng tốt
      delta: faster === null || faster === 0 ? null : { ...absoluteDelta(faster, ' phút'), good: faster < 0 },
      series: minutes.series.map((m) => -m),
      note: 'Trung bình thời gian gọi lại hồ sơ mới',
    },
    { label: 'Điểm đánh giá', value: decimal(d.rating.value), delta: d.rating.newReviews ? absoluteDelta(d.rating.newReviews) : null, series: d.rating.series, note: `${formatNumber(d.rating.reviewCount)} đánh giá từ người lao động` },
    { label: 'Lao động đã bay', value: formatNumber(d.departed.value), delta: d.departed.inRange ? absoluteDelta(d.departed.inRange) : null, series: d.departed.series, note: `${d.departed.inRange} người xuất cảnh trong ${d.range} ngày qua` },
  ];
}

function funnelInsight(d: Dashboard, company: boolean) {
  const f = d.funnel;
  if (company) {
    const rate = f.interview ? (f.passed / f.interview) * 100 : 0;
    return (
      <>
        Tỉ lệ phỏng vấn → trúng tuyển của bạn là <b>{decimal(rate)}%</b> trong {d.range} ngày qua.
      </>
    );
  }
  const rate = f.applied ? (f.contacted / f.applied) * 100 : 0;
  return (
    <>
      Bạn đã liên hệ <b>{decimal(rate)}% hồ sơ</b> nhận được trong {d.range} ngày qua.
    </>
  );
}

/* ---------- Doanh nghiệp: cảnh báo hồ sơ quá 24 giờ ---------- */
function OverdueBanner({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="dash-alert">
      <span className="dash-alert__icon">
        <IconBoltLine size={19} className="icon--w2" />
      </span>
      <p className="dash-alert__text">
        <b>{count} hồ sơ mới chưa được liên hệ quá 24 giờ.</b> Gọi lại trong 30 phút đầu giúp tỉ lệ ứng viên nhận phỏng vấn cao gấp 2 lần.
      </p>
      <Link href={`${EMPLOYER_BASE}/ung-vien?quick=overdue`} className="dash-alert__cta">
        Xử lý ngay
      </Link>
    </div>
  );
}

/* ---------- Cá nhân: mức độ tin cậy + liên kết sắp hết hạn ---------- */
function IndividualTop({ data, onRenewed }: { data: Dashboard; onRenewed: () => Promise<void> }) {
  const { account } = useEmployerAccount();
  const trust = data.trust;
  const expiring = data.partners.find((p) => p.expiresAt && daysUntil(p.expiresAt) <= 30);
  return (
    <div className="dash-grid">
      {trust && (
        <div className="emp-card dash-trust">
          <span className="dash-trust__ring" style={{ '--score': `${trust.score}%` } as CSSProperties}>
            <span className="dash-trust__inner">
              <b>{trust.score}</b>
              <small>/100</small>
            </span>
          </span>
          <span className="dash-trust__body">
            <span className="dash-trust__head">
              <span>
                <h2 className="emp-card__title">Mức độ tin cậy của bạn</h2>
                <p className="emp-card__sub">Hiển thị trên hồ sơ công khai{trust.percentile > 0 ? ` · cao hơn ${trust.percentile}% NTD cá nhân` : ''}</p>
              </span>
              <Link href={`/tu-van-vien/${account.recruiter.slug}`} className="dash-trust__link">
                Xem hồ sơ public
              </Link>
            </span>
            <span className="dash-trust__checks">
              {trust.checks.map((c) => (
                <span key={c.key} className={cx('dash-chip', !c.ok && 'dash-chip--warn')}>
                  {c.ok ? <IconCheck size={12} className="icon--w3" /> : <IconExclaim size={12} className="icon--w3" />}
                  {c.label}
                </span>
              ))}
            </span>
          </span>
        </div>
      )}
      {expiring ? <PartnerAlert partner={expiring} overdue={data.overdueApplicants} onRenewed={onRenewed} /> : <span />}
    </div>
  );
}

function PartnerAlert({ partner, overdue, onRenewed }: { partner: EmployerPartnerItem; overdue: number; onRenewed: () => Promise<void> }) {
  const [sent, setSent] = useState(partner.renewRequested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const renew = async () => {
    setBusy(true);
    setError('');
    try {
      await apiRequest<void>(`/employer/partners/${encodeURIComponent(partner.id)}/renew`, { method: 'POST' });
      setSent(true);
      await onRenewed();
    } catch (e) {
      setError(apiMessage(e, 'Chưa gửi được yêu cầu, vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="dash-partner-alert">
      <span className="dash-partner-alert__head">
        <span className="dash-alert__icon dash-alert__icon--sm">
          <IconLink size={17} className="icon--w2" />
        </span>
        <b>
          Liên kết {partner.employer.name} hết hạn {dayMonth(partner.expiresAt!, true)}
        </b>
      </span>
      <p className="dash-partner-alert__text">
        Sau ngày này, {partner.jobCount} tin đang đăng qua doanh nghiệp này sẽ tạm ẩn. Gửi yêu cầu gia hạn để không gián đoạn tuyển dụng.
      </p>
      <span className="dash-partner-alert__actions">
        <button type="button" className="dash-alert__cta dash-alert__cta--sm" onClick={() => void renew()} disabled={busy || sent}>
          {sent ? 'Đã gửi yêu cầu gia hạn' : busy ? 'Đang gửi…' : 'Gửi yêu cầu gia hạn'}
        </button>
        {overdue > 0 && (
          <Link href={`${EMPLOYER_BASE}/ung-vien?quick=overdue`} className="dash-partner-alert__ghost">
            {overdue} hồ sơ chờ quá 24h
          </Link>
        )}
      </span>
      {error && (
        <span className="dash-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/* ---------- Hồ sơ mới nhất ---------- */
function LatestApplicants({ data }: { data: Dashboard }) {
  return (
    <div className="emp-card dash-latest">
      <div className="dash-latest__head">
        <h2 className="emp-card__title">Hồ sơ mới nhất</h2>
        <Link href={`${EMPLOYER_BASE}/ung-vien`} className="emp-link-btn">
          Mở bảng ứng viên
        </Link>
      </div>
      <div className="dash-table" role="table" aria-label="Hồ sơ mới nhất">
        <div className="dash-table__row dash-table__row--head" role="row">
          <span role="columnheader">Ứng viên</span>
          <span role="columnheader">Đơn ứng tuyển</span>
          <span role="columnheader">Phù hợp</span>
          <span role="columnheader" className="dash-table__right">
            Liên hệ
          </span>
        </div>
        {data.latest.map((a) => (
          <div key={a.id} className="dash-table__row" role="row">
            <Link href={`${EMPLOYER_BASE}/ung-vien?id=${a.id}`} className="dash-person" role="cell">
              <ApplicantAvatar name={a.fullName} />
              <span className="dash-person__text">
                <span className="dash-person__name">{a.fullName}</span>
                <span className="dash-person__meta">
                  {GENDER_SHORT[a.gender]} · {a.age}t{a.hometown ? ` · ${a.hometown}` : ''}
                </span>
              </span>
            </Link>
            <span className="dash-job" role="cell">
              <span className="dash-job__title">{a.jobShortTitle}</span>
              <span className={cx('dash-job__time', a.overdue && 'dash-job__time--late')}>{timeAgo(a.createdAt)}</span>
            </span>
            <span role="cell" className="dash-table__match">
              <MatchBadge score={a.matchScore} />
            </span>
            <span role="cell" className="dash-table__contact">
              <ContactButtons phone={a.phone} name={a.fullName} />
            </span>
          </div>
        ))}
        {!data.latest.length && <p className="emp-state">Chưa có hồ sơ ứng tuyển.</p>}
      </div>
    </div>
  );
}

/* ---------- Lịch phỏng vấn hôm nay ---------- */
function TodayInterviews({ data }: { data: Dashboard }) {
  const list = data.todayInterviews;
  const firstUpcoming = list.find((i) => i.phase === 'upcoming')?.id;
  const label = (i: Dashboard['todayInterviews'][number]) => {
    if (i.phase === 'live') return 'Đang diễn ra';
    if (i.phase === 'done') return 'Đã xong';
    if (i.id === firstUpcoming) return 'Sắp tới';
    return i.kind === 'online' ? 'Online' : i.kind === 'onsite' ? 'Trực tiếp' : 'Nhóm';
  };
  return (
    <div className="emp-card dash-today">
      <div className="dash-today__head">
        <h2 className="emp-card__title">Lịch phỏng vấn hôm nay</h2>
        <span className="dash-count">{list.length} cuộc</span>
      </div>
      {list.map((i) => (
        <Link key={i.id} href={`${EMPLOYER_BASE}/lich-phong-van?id=${i.id}`} className="dash-slot">
          <span className="dash-slot__time">{hourMinute(i.startAt)}</span>
          <span className={cx('dash-slot__bar', `dash-slot__bar--${i.kind}`)} aria-hidden="true" />
          <span className="dash-slot__text">
            <span className="dash-slot__title">{i.title}</span>
            <span className="dash-slot__sub">{i.subtitle}</span>
          </span>
          <span className={cx('dash-slot__tag', `dash-slot__tag--${i.kind}`, i.id === firstUpcoming && 'dash-slot__tag--next', i.phase !== 'upcoming' && `dash-slot__tag--${i.phase}`)}>{label(i)}</span>
        </Link>
      ))}
      {!list.length && <p className="dash-empty">Hôm nay chưa có lịch hẹn.</p>}
    </div>
  );
}

/* ---------- Doanh nghiệp: tin cần chú ý ---------- */
function Attention({ data, onChanged }: { data: Dashboard; onChanged: () => Promise<void> }) {
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const pause = async (jobId: string) => {
    setError('');
    try {
      await apiRequest<void>(`/employer/jobs/${encodeURIComponent(jobId)}/pause`, { method: 'POST' });
      setPaused((p) => ({ ...p, [jobId]: true }));
      await onChanged();
    } catch (e) {
      setError(apiMessage(e, 'Không tạm ẩn được tin.'));
    }
  };
  const ICON = { low_applicants: IconTrendUp, expiring: IconClock, quota_full: IconCheck };
  return (
    <div className="emp-card dash-list">
      <h2 className="emp-card__title">Tin cần chú ý</h2>
      {data.attention.map((a) => {
        const Icon = ICON[a.kind];
        return (
          <div key={a.jobId} className="dash-list__row">
            <span className={cx('dash-list__icon', `dash-list__icon--${a.kind}`)}>
              <Icon size={16} className="icon--w2" />
            </span>
            <span className="dash-list__text">
              <span className="dash-list__title">{a.title}</span>
              <span className="dash-list__desc">{a.text}</span>
            </span>
            {a.kind === 'quota_full' ? (
              <button type="button" className="emp-btn emp-btn--sm" onClick={() => void pause(a.jobId)} disabled={paused[a.jobId]}>
                {paused[a.jobId] ? 'Đã ẩn' : 'Tạm ẩn'}
              </button>
            ) : (
              <Link href={`${EMPLOYER_BASE}/don-hang/${a.jobId}/sua`} className="emp-btn emp-btn--sm">
                {a.kind === 'expiring' ? 'Gia hạn' : 'Sửa lương'}
              </Link>
            )}
          </div>
        );
      })}
      {!data.attention.length && <p className="dash-empty">Các tin đang hoạt động tốt.</p>}
      {error && (
        <p className="dash-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Cá nhân: doanh nghiệp phái cử ---------- */
function Partners({ partners }: { partners: EmployerPartnerItem[] }) {
  return (
    <div className="emp-card dash-list" id="doanh-nghiep-phai-cu">
      <div className="dash-today__head">
        <h2 className="emp-card__title">Doanh nghiệp phái cử</h2>
      </div>
      {partners.map((p) => {
        const left = p.expiresAt ? daysUntil(p.expiresAt) : null;
        const expiring = left !== null && left <= 30;
        const desc = expiring
          ? `${p.jobCount} tin · liên kết hết hạn ${dayMonth(p.expiresAt!, true)} (còn ${left} ngày)`
          : p.jobCount
            ? `${p.jobCount} tin${p.pendingJobs ? ` · ${p.pendingJobs} tin đang chờ doanh nghiệp duyệt` : ''}`
            : `Xí nghiệp tiếp nhận · ${formatNumber(p.departedCount)} lao động đã xuất cảnh`;
        return (
          <div key={p.id} className="dash-list__row">
            <span className={cx('dash-list__icon', expiring ? 'dash-list__icon--expiring' : p.jobCount ? 'dash-list__icon--partner' : 'dash-list__icon--quota_full')}>
              {expiring ? <IconClock size={16} className="icon--w2" /> : p.jobCount ? <IconBuilding size={16} className="icon--w2" /> : <IconCheck size={16} className="icon--w2" />}
            </span>
            <span className="dash-list__text">
              <span className="dash-list__title">{p.employer.name}</span>
              <span className="dash-list__desc">{desc}</span>
            </span>
            <Link href={`/nha-tuyen-dung/${p.employer.slug}`} className="emp-btn emp-btn--sm">
              Xem
            </Link>
          </div>
        );
      })}
      {!partners.length && <p className="dash-empty">Chưa liên kết doanh nghiệp phái cử nào.</p>}
    </div>
  );
}
