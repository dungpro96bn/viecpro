'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  APPLICATION_SOURCE_LABEL,
  DELETABLE_JOB_STATUSES,
  EMPLOYER_JOB_TABS,
  INDUSTRIES,
  JOB_STATUS_LABEL,
  TRASH_RETENTION_DAYS,
  type EmployerJobItem,
  type EmployerJobList,
  type EmployerJobSort,
  type EmployerJobStats,
  type EmployerJobSummary,
  type EmployerJobTab,
  type Industry,
  type JobActivityItem,
} from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import Pager from '@/components/employer/Pager';
import Select from '@/components/ui/Select';
import {
  IconArrowUp,
  IconBarChart,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTrendUp,
  IconUser,
} from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { compactNumber, dayMonth, daysUntil, decimal, hourMinute, percentDelta, timeAgo, weekdayShort } from '@/lib/employer';
import { cx, formatNumber } from '@/lib/format';

const PER_PAGE = 10;
const TAB_LABEL: Record<EmployerJobTab, string> = { visible: 'Đang hiển thị', pending: 'Chờ duyệt', draft: 'Bản nháp', expired: 'Hết hạn' };
const SORT_OPTIONS: Array<{ value: EmployerJobSort; label: string }> = [
  { value: 'updated', label: 'Mới cập nhật' },
  { value: 'newest', label: 'Mới đăng' },
  { value: 'applications', label: 'Nhiều hồ sơ nhất' },
  { value: 'deadline', label: 'Sắp hết hạn' },
];
const ACTION_TEXT: Record<string, string> = {
  create: 'tạo tin',
  submit: 'gửi duyệt tin',
  draft: 'lưu nháp tin',
  update: 'cập nhật tin',
  boost: 'đẩy tin',
  pause: 'tạm ẩn tin',
  resume: 'mở lại tin',
  close: 'đóng tin',
  approve: 'được duyệt tin',
  reject: 'bị từ chối tin',
};

/** Quản lý tin tuyển dụng (design 12) */
export default function JobsManager() {
  const { account, refresh: refreshAccount } = useEmployerAccount();
  const [tab, setTab] = useState<EmployerJobTab>(() => {
    if (typeof window === 'undefined') return 'visible';
    const t = new URLSearchParams(window.location.search).get('tab');
    return EMPLOYER_JOB_TABS.includes(t as EmployerJobTab) ? (t as EmployerJobTab) : 'visible';
  });
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState<Industry | ''>('');
  const [sort, setSort] = useState<EmployerJobSort>('updated');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<EmployerJobList | null>(null);
  const [summary, setSummary] = useState<EmployerJobSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const params = useMemo(() => {
    const p = new URLSearchParams({ tab, sort, page: String(page), limit: String(PER_PAGE) });
    if (query) p.set('q', query);
    if (industry) p.set('industry', industry);
    return p;
  }, [tab, sort, page, query, industry]);

  useEffect(() => {
    let active = true;
    apiRequest<EmployerJobList>(`/employer/jobs?${params.toString()}`)
      .then((data) => {
        if (!active) return;
        setList(data);
        setError('');
        setSelectedId((id) => (id && data.items.some((j) => j.id === id) ? id : (data.items[0]?.id ?? null)));
      })
      .catch((e: unknown) => active && setError(apiMessage(e, 'Không tải được danh sách tin.')));
    return () => {
      active = false;
    };
  }, [params, reloadKey]);

  useEffect(() => {
    void apiRequest<EmployerJobSummary>('/employer/jobs/summary').then(setSummary).catch(() => setSummary(null));
  }, [reloadKey]);

  // Đổi tab / bộ lọc: về trang 1, bỏ chọn
  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
    setChecked(new Set());
  };

  const reload = useCallback(async () => {
    setReloadKey((k) => k + 1);
    await refreshAccount();
  }, [refreshAccount]);

  const items = list?.items ?? [];
  const allChecked = items.length > 0 && items.every((j) => checked.has(j.id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(items.map((j) => j.id)));
  const toggleOne = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (action: 'pause' | 'close' | 'delete') => {
    setError('');
    if (action === 'delete') {
      const closing = tab !== 'draft' && tab !== 'expired';
      const where = account.kind === 'company' && !account.companyAdmin ? 'Quản trị viên doanh nghiệp' : 'Bạn';
      if (!window.confirm(`${closing ? `Đóng và xoá ${checked.size} tin` : `Xoá ${checked.size} tin`}? Tin chuyển vào Thùng rác. ${where} có thể khôi phục trong ${TRASH_RETENTION_DAYS} ngày. Hồ sơ ứng tuyển vẫn được giữ.`)) return;
    }
    try {
      for (const id of checked) {
        if (action === 'delete') {
          const status = items.find((j) => j.id === id)?.status;
          if (status && !isDeletable(status)) await apiRequest(`/employer/jobs/${encodeURIComponent(id)}/close`, { method: 'POST' });
        }
        await apiRequest(`/employer/jobs/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      }
      setChecked(new Set());
      await reload();
    } catch (e) {
      setError(apiMessage(e, 'Không cập nhật được một số tin.'));
      await reload();
    }
  };

  const company = account.kind === 'company';

  return (
    <div className="jobs-page">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">{company ? 'Tin tuyển dụng' : 'Tin của tôi'}</span>
          </nav>
          <h1 className="emp-page-head__title">{company ? 'Tin tuyển dụng' : 'Tin của tôi'}</h1>
        </span>
        <span className="emp-page-head__actions">
          <button type="button" className="emp-btn jobs-head-btn" onClick={() => void exportCsv(tab, query, industry, sort)}>
            <IconDownload size={16} />
            Xuất báo cáo
          </button>
          <Link href={`${EMPLOYER_BASE}/don-hang/dang-tin`} className="emp-btn emp-btn--primary jobs-head-btn">
            <IconPlus size={17} className="icon--w24" />
            Đăng tin mới
          </Link>
        </span>
      </div>

      {summary && <SummaryCards s={summary} />}

      <div className="jobs-layout">
        <div className="jobs-main">
          <div className="emp-card jobs-table">
            <div className="jobs-tabs" role="tablist" aria-label="Trạng thái tin">
              {EMPLOYER_JOB_TABS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={cx('jobs-tabs__tab', tab === t && 'jobs-tabs__tab--active')} onClick={() => change(setTab)(t)}>
                  {TAB_LABEL[t]}
                  <span className="jobs-tabs__count">{list?.counts[t] ?? 0}</span>
                </button>
              ))}
            </div>

            <form
              className="emp-filters"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                change(setQuery)(q.trim());
              }}
            >
              <label className="emp-find">
                <IconSearch size={16} />
                <input className="emp-find__input" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== query && change(setQuery)(q.trim())} placeholder="Tìm theo tiêu đề hoặc mã tin…" aria-label="Tìm tin" />
              </label>
              <span className="emp-filter">
                <Select className="field-input field-input--select emp-filter__select" aria-label="Ngành nghề" value={industry} onChange={(v) => change(setIndustry)(v as Industry | '')} options={[{ value: '', label: 'Tất cả ngành nghề' }, ...INDUSTRIES]} />
              </span>
              <span className="emp-filter emp-filter--sort">
                <Select className="field-input field-input--select emp-filter__select" aria-label="Sắp xếp" value={sort} onChange={(v) => change(setSort)(v as EmployerJobSort)} options={SORT_OPTIONS} />
              </span>
            </form>

            {checked.size > 0 && (
              <div className="jobs-bulk" role="region" aria-label="Thao tác hàng loạt">
                <span>Đã chọn {checked.size} tin</span>
                {tab === 'visible' && (
                  <button type="button" className="emp-btn emp-btn--md" onClick={() => void bulk('pause')}>
                    <IconEyeOff size={15} />
                    Tạm ẩn
                  </button>
                )}
                {tab !== 'expired' && (
                  <button type="button" className="emp-btn emp-btn--md emp-btn--danger" onClick={() => void bulk('close')}>
                    Đóng tin
                  </button>
                )}
                <button type="button" className="emp-btn emp-btn--md emp-btn--danger" onClick={() => void bulk('delete')}>
                  <IconTrash size={15} />
                  Xoá
                </button>
                <button type="button" className="emp-link-btn" onClick={() => setChecked(new Set())}>
                  Bỏ chọn
                </button>
              </div>
            )}

            <div className="jobs-grid jobs-grid--head" role="row">
              <Checkbox checked={allChecked} onChange={toggleAll} label="Chọn tất cả tin trên trang" />
              <span>Tin tuyển dụng</span>
              <span>Hồ sơ</span>
              <span>Chỉ tiêu</span>
              <span>Hạn</span>
            </div>
            {items.map((j) => (
              <JobRow key={j.id} job={j} selected={j.id === selectedId} checked={checked.has(j.id)} onCheck={() => toggleOne(j.id)} onSelect={() => setSelectedId(j.id)} />
            ))}
            {list && !items.length && <p className="emp-empty">Không có tin nào trong mục này.</p>}
            {error && (
              <p className="emp-error" role="alert">
                {error}
              </p>
            )}

            <Pager page={page} perPage={PER_PAGE} total={list?.total ?? 0} shown={items.length} noun="tin tuyển dụng" onPage={setPage} />
          </div>

          {summary && (
            <div className="jobs-bottom">
              <Sources s={summary} />
              <Activity items={summary.activity} />
            </div>
          )}
        </div>

        {selectedId ? <JobPanel key={selectedId} jobId={selectedId} onChanged={reload} /> : <aside className="emp-card jobs-panel jobs-panel--empty">Chọn một tin để xem chi tiết.</aside>}
      </div>
    </div>
  );
}


/** Tin xoá thẳng được (nháp / bị từ chối / đã đóng); trạng thái khác phải đóng trước */
const isDeletable = (status: string) => (DELETABLE_JOB_STATUSES as readonly string[]).includes(status);
/* ---------- Thẻ chỉ số ---------- */
function SummaryCards({ s }: { s: EmployerJobSummary }) {
  const views = percentDelta(s.views7, s.viewsPrev7);
  const cards = [
    { label: 'Đang hiển thị', value: `${s.visible} tin`, note: `${s.expiringSoon} tin hết hạn trong 45 ngày`, tone: 'blue', icon: IconEye, noteTone: '' },
    { label: 'Lượt xem 7 ngày', value: compactNumber(s.views7), note: views ? `${views.text} so với tuần trước` : 'Chưa có số liệu tuần trước', tone: 'green', icon: IconTrendUp, noteTone: views && !views.up ? 'down' : 'up' },
    { label: 'Hồ sơ mới', value: formatNumber(s.newApplications7), note: `${s.unseen} hồ sơ chưa xem`, tone: 'orange', icon: IconUser, noteTone: s.unseen ? 'warn' : '' },
    { label: 'Tỉ lệ chuyển đổi', value: `${decimal(s.conversion)}%`, note: `Trung bình toàn sàn ${decimal(s.marketConversion)}%`, tone: 'purple', icon: IconBarChart, noteTone: s.conversion >= s.marketConversion ? 'up' : 'down' },
    { label: 'Chỉ tiêu đã tuyển', value: `${formatNumber(s.passed)}/${formatNumber(s.quota)}`, note: `${s.quota ? Math.round((s.passed / s.quota) * 100) : 0}% tổng chỉ tiêu`, tone: 'cyan', icon: IconCheck, noteTone: '' },
  ];
  return (
    <div className="jobs-stats">
      {cards.map((c) => (
        <div key={c.label} className="jobs-stat">
          <span className="jobs-stat__head">
            <span className="jobs-stat__label">{c.label}</span>
            <span className={cx('jobs-stat__icon', `jobs-stat__icon--${c.tone}`)}>
              <c.icon size={15} className="icon--w2" />
            </span>
          </span>
          <span className="jobs-stat__value">{c.value}</span>
          <span className={cx('jobs-stat__note', c.noteTone && `jobs-stat__note--${c.noteTone}`)}>{c.note}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Dòng tin ---------- */
function JobRow({ job, selected, checked, onCheck, onSelect }: { job: EmployerJobItem; selected: boolean; checked: boolean; onCheck: () => void; onSelect: () => void }) {
  const pct = job.quantity ? Math.min(100, Math.round((job.passed / job.quantity) * 100)) : 0;
  const left = job.deadline ? daysUntil(job.deadline) : null;
  return (
    <div className={cx('jobs-grid jobs-row', selected && 'jobs-row--selected')} role="row" onClick={onSelect}>
      <Checkbox checked={checked} onChange={onCheck} label={`Chọn tin ${job.code}`} />
      <span className="jobs-row__job">
        <img className="jobs-row__img" src={job.imageUrl} alt="" />
        <span className="jobs-row__text">
          <button type="button" className="jobs-row__title" onClick={onSelect} aria-pressed={selected}>
            {job.title}
          </button>
          <span className="jobs-row__meta">
            <StatusChip status={job.status} />
            <span>{job.code}</span>
            <span className="jobs-row__dot">·</span>
            <span>{formatNumber(job.views)} lượt xem</span>
            {job.recruiter.photoUrl ? <img className="jobs-row__owner" src={job.recruiter.photoUrl} alt={job.recruiter.name} title={job.recruiter.name} /> : null}
          </span>
        </span>
      </span>
      <span className="jobs-row__apps">
        <b>{formatNumber(job.applications)}</b>
        {job.newApplications > 0 && <span className="jobs-row__new">{job.newApplications} mới</span>}
      </span>
      <span className="jobs-row__quota">
        <span>
          {job.passed}/{job.quantity} đã tuyển
        </span>
        <span className="emp-bar">
          <span className={cx('emp-bar__fill', pct >= 90 && 'emp-bar__fill--success')} style={{ width: `${pct}%` }} />
        </span>
      </span>
      <span className="jobs-row__deadline">
        <span className={cx('jobs-row__date', left !== null && left <= 3 && job.status === 'open' && 'jobs-row__date--late')}>{job.deadline ? dayMonth(job.deadline, true) : '—'}</span>
        <span className="jobs-row__left">{job.status === 'closed' ? 'Đã đóng' : left === null ? 'Không thời hạn' : left === 0 ? 'Hết hạn hôm nay' : `còn ${left} ngày`}</span>
      </span>
    </div>
  );
}

function StatusChip({ status, className }: { status: EmployerJobItem['status']; className?: string }) {
  return <span className={cx('emp-status', `emp-status--${status}`, className)}>{JOB_STATUS_LABEL[status]}</span>;
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={cx('jobs-check', checked && 'jobs-check--on')}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      <IconCheck size={12} className="icon--w32" />
    </button>
  );
}

/* ---------- Bảng chi tiết tin ---------- */
function JobPanel({ jobId, onChanged }: { jobId: string; onChanged: () => Promise<void> }) {
  const { account } = useEmployerAccount();
  const [stats, setStats] = useState<EmployerJobStats | null>(null);
  const [busy, setBusy] = useState<'' | 'boost' | 'pause' | 'resume' | 'delete'>('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<EmployerJobStats>(`/employer/jobs/${encodeURIComponent(jobId)}/stats`)
      .then((s) => active && setStats(s))
      .catch((e: unknown) => active && setMessage({ ok: false, text: apiMessage(e, 'Không tải được chi tiết tin.') }));
    return () => {
      active = false;
    };
  }, [jobId]);

  const act = async (action: 'boost' | 'pause' | 'resume') => {
    setBusy(action);
    setMessage(null);
    try {
      const job = await apiRequest<EmployerJobItem>(`/employer/jobs/${encodeURIComponent(jobId)}/${action}`, { method: 'POST' });
      setStats((s) => (s ? { ...s, job } : s));
      setMessage({ ok: true, text: action === 'boost' ? 'Đã đẩy tin lên đầu danh sách.' : action === 'pause' ? 'Đã tạm ẩn tin.' : job.status === 'pending' ? 'Đã gửi tin chờ duyệt lại.' : 'Tin đã hiển thị trở lại.' });
      await onChanged();
    } catch (e) {
      setMessage({ ok: false, text: apiMessage(e, 'Thao tác chưa thành công.') });
    } finally {
      setBusy('');
    }
  };

  /** Xoá mềm vào Thùng rác – khôi phục được trong 30 ngày. Tin còn hiển thị / chờ duyệt thì đóng trước rồi mới xoá */
  const remove = async () => {
    if (!stats) return;
    const { job } = stats;
    const mustClose = !isDeletable(job.status);
    const where = account.kind === 'company' && !account.companyAdmin ? 'Quản trị viên doanh nghiệp' : 'Bạn';
    const intro = mustClose ? `Tin ${job.code} đang ở trạng thái “${JOB_STATUS_LABEL[job.status]}”. Tin sẽ được đóng (ngừng nhận hồ sơ) rồi chuyển vào Thùng rác.` : `Xoá tin ${job.code}? Tin chuyển vào Thùng rác.`;
    if (!window.confirm(`${intro} ${where} có thể khôi phục trong ${TRASH_RETENTION_DAYS} ngày. Hồ sơ ứng tuyển vẫn được giữ.`)) return;
    setBusy('delete');
    setMessage(null);
    try {
      if (mustClose) await apiRequest(`/employer/jobs/${encodeURIComponent(jobId)}/close`, { method: 'POST' });
      await apiRequest<void>(`/employer/jobs/${encodeURIComponent(jobId)}/delete`, { method: 'POST' });
      await onChanged();
    } catch (e) {
      setMessage({ ok: false, text: apiMessage(e, 'Không xoá được tin.') });
      setBusy('');
      // Có thể đã đóng tin xong nhưng xoá lỗi – tải lại để danh sách đúng trạng thái
      if (mustClose) void onChanged();
    }
  };

  if (!stats) return <aside className="emp-card jobs-panel jobs-panel--empty">{message?.text ?? 'Đang tải…'}</aside>;
  const { job } = stats;
  const max = Math.max(1, ...stats.daily.map((d) => d.count));
  const total7 = stats.daily.reduce((s, d) => s + d.count, 0);
  const boostsLeft = account.plan ? account.plan.boostQuota - account.plan.boostsUsed : 0;
  const href = (target: 'applicants' | 'edit' | null) =>
    target === 'applicants' ? `${EMPLOYER_BASE}/ung-vien?job=${job.id}&quick=unseen` : target === 'edit' ? `${EMPLOYER_BASE}/don-hang/${job.id}/sua` : null;

  return (
    <aside className="emp-card jobs-panel" aria-label="Chi tiết tin">
      <div className="jobs-panel__cover">
        <img src={job.imageUrl} alt="" />
        <span className="jobs-panel__shade" />
        <StatusChip status={job.status} className="jobs-panel__status" />
        <span className="jobs-panel__caption">
          <span>Mã tin {job.code}</span>
          <span>{job.publishedAt ? `Đăng ${dayMonth(job.publishedAt, true)}` : `Tạo ${dayMonth(job.createdAt, true)}`}</span>
        </span>
      </div>
      <div className="jobs-panel__body">
        <span className="jobs-panel__titles">
          <Link href={`/viec-lam/${job.slug}`} className="jobs-panel__title">
            {job.title}
          </Link>
          <span className="jobs-panel__owner">
            {job.recruiter.photoUrl && <img src={job.recruiter.photoUrl} alt="" />}
            <span>{job.recruiter.name}</span>
            <span className="jobs-row__dot">·</span>
            <span>{job.industry}</span>
          </span>
        </span>
        {job.rejectReason && job.status === 'rejected' && <p className="jobs-panel__reject">Lý do từ chối: {job.rejectReason}</p>}

        <div className="jobs-panel__stats">
          <PanelStat label="Lượt xem" value={formatNumber(job.views)} />
          <PanelStat label="Hồ sơ" value={formatNumber(job.applications)} />
          <PanelStat label="Chuyển đổi" value={`${decimal(stats.conversion)}%`} />
          <PanelStat label="Đã tuyển" value={`${job.passed}/${job.quantity}`} />
        </div>

        <div className="jobs-panel__chart">
          <span className="jobs-panel__row">
            <b>Hồ sơ 7 ngày qua</b>
            <span>{total7} hồ sơ</span>
          </span>
          <div className="jobs-week" role="img" aria-label={`${total7} hồ sơ trong 7 ngày`}>
            {stats.daily.map((d, i) => (
              <span key={d.date} className="jobs-week__col">
                <span className="jobs-week__value">{d.count}</span>
                <span className={cx('jobs-week__bar', i === stats.daily.length - 1 && 'jobs-week__bar--today')} style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
                <span className="jobs-week__day">{weekdayShort(new Date(`${d.date}T00:00:00`))}</span>
              </span>
            ))}
          </div>
        </div>

        {stats.suggestions.length > 0 && (
          <div className="jobs-tips">
            <b>Gợi ý tối ưu</b>
            {stats.suggestions.map((s) => {
              const link = href(s.target);
              return (
                <span key={s.kind} className="jobs-tip">
                  <span className={cx('jobs-tip__icon', `jobs-tip__icon--${s.kind}`)}>{s.kind === 'conversion_up' ? <IconTrendUp size={14} className="icon--w22" /> : <IconClock size={14} className="icon--w22" />}</span>
                  <span className="jobs-tip__text">
                    <span>{s.text}</span>
                    {link && (
                      <Link href={link} className="jobs-tip__link">
                        {s.target === 'applicants' ? 'Xem hồ sơ mới →' : 'Sửa tin →'}
                      </Link>
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        <div className="jobs-panel__actions">
          <button type="button" className="emp-btn emp-btn--primary emp-btn--lg jobs-panel__boost" disabled={job.status !== 'open' || busy !== '' || boostsLeft <= 0} onClick={() => void act('boost')} title={`Còn ${boostsLeft} lượt đẩy tin`}>
            <IconArrowUp size={16} className="icon--w22" />
            {busy === 'boost' ? 'Đang đẩy tin…' : 'Đẩy tin lên đầu'}
          </button>
          <span className="jobs-panel__pair">
            <Link href={`${EMPLOYER_BASE}/don-hang/${job.id}/sua`} className="emp-btn">
              <IconEdit size={15} />
              Sửa tin
            </Link>
            {job.status === 'paused' ? (
              <button type="button" className="emp-btn" disabled={busy !== ''} onClick={() => void act('resume')}>
                <IconEye size={15} />
                Mở lại
              </button>
            ) : (
              <button type="button" className="emp-btn" disabled={job.status !== 'open' || busy !== ''} onClick={() => void act('pause')}>
                <IconEyeOff size={15} />
                Tạm ẩn
              </button>
            )}
          </span>
          <button type="button" className="emp-btn jobs-panel__delete" disabled={busy !== ''} onClick={() => void remove()}>
            <IconTrash size={15} />
            {busy === 'delete' ? 'Đang xoá…' : isDeletable(job.status) ? 'Xoá tin' : 'Đóng & xoá tin'}
          </button>
          {message && (
            <p className={cx('jobs-panel__msg', !message.ok && 'jobs-panel__msg--error')} role={message.ok ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}
          <Link href={`${EMPLOYER_BASE}/ung-vien?job=${job.id}`} className="jobs-panel__apps">
            Xem {formatNumber(job.applications)} hồ sơ ứng tuyển
            <IconChevronRight size={15} className="icon--w22" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function PanelStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="jobs-panel__stat">
      <span>{label}</span>
      <b>{value}</b>
    </span>
  );
}

/* ---------- Nguồn hồ sơ + hoạt động ---------- */
function Sources({ s }: { s: EmployerJobSummary }) {
  const total = s.sources.reduce((n, x) => n + x.count, 0);
  const top = s.sources[0]?.count ?? 1;
  return (
    <div className="emp-card jobs-box">
      <span className="jobs-box__head">
        <b>Nguồn hồ sơ</b>
        <span>30 ngày qua</span>
      </span>
      {s.sources.map((x, i) => (
        <span key={x.source} className="jobs-source">
          <span className="jobs-source__row">
            <span>{APPLICATION_SOURCE_LABEL[x.source]}</span>
            <b>{total ? Math.round((x.count / total) * 100) : 0}%</b>
          </span>
          <span className="jobs-source__track">
            <span className={cx('jobs-source__fill', `jobs-source__fill--${i % 4}`)} style={{ width: `${(x.count / top) * 100}%` }} />
          </span>
        </span>
      ))}
      {!s.sources.length && <p className="emp-empty">Chưa có hồ sơ trong 30 ngày qua.</p>}
    </div>
  );
}

function Activity({ items }: { items: JobActivityItem[] }) {
  const when = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 86400_000 && d.getDate() === new Date().getDate()) return timeAgo(iso);
    if (diff < 2 * 86400_000) return `Hôm qua, ${hourMinute(d)}`;
    return `${dayMonth(d, true)}, ${hourMinute(d)}`;
  };
  return (
    <div className="emp-card jobs-box">
      <span className="jobs-box__head">
        <b>Hoạt động gần đây</b>
      </span>
      {items.map((a) => (
        <span key={a.id} className="jobs-activity">
          {a.actor?.photoUrl ? <img className="jobs-activity__avatar" src={a.actor.photoUrl} alt="" /> : <span className="jobs-activity__avatar jobs-activity__avatar--system">vp</span>}
          <span className="jobs-activity__text">
            <span>
              <b>{a.actor?.name ?? 'viecpro'}</b> {ACTION_TEXT[a.action] ?? a.action} {a.jobCode}
              {a.action === 'boost' ? ' lên đầu' : ''}
              {a.note ? ` – ${a.note.charAt(0).toLowerCase()}${a.note.slice(1)}` : ''}
            </span>
            <span className="jobs-activity__time">{when(a.at)}</span>
          </span>
        </span>
      ))}
      {!items.length && <p className="emp-empty">Chưa có hoạt động.</p>}
    </div>
  );
}


/** Xuất CSV toàn bộ tin của tab đang xem (tối đa 1.000 tin) */
async function exportCsv(tab: EmployerJobTab, q: string, industry: string, sort: EmployerJobSort) {
  const rows: EmployerJobItem[] = [];
  for (let page = 1; page <= 20; page++) {
    const p = new URLSearchParams({ tab, sort, page: String(page), limit: '50' });
    if (q) p.set('q', q);
    if (industry) p.set('industry', industry);
    const data = await apiRequest<EmployerJobList>(`/employer/jobs?${p.toString()}`);
    rows.push(...data.items);
    if (!data.hasMore) break;
  }
  const head = ['Mã tin', 'Tiêu đề', 'Trạng thái', 'Ngành', 'Tỉnh', 'Lượt xem', 'Hồ sơ', 'Hồ sơ chưa xem', 'Đã tuyển', 'Chỉ tiêu', 'Hạn nhận hồ sơ', 'Cán bộ phụ trách'];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((j) =>
    [j.code, j.title, JOB_STATUS_LABEL[j.status], j.industry, j.pref, j.views, j.applications, j.newApplications, j.passed, j.quantity, j.deadline ? dayMonth(j.deadline, true) : '', j.recruiter.name].map(esc).join(','),
  );
  // BOM để Excel đọc đúng tiếng Việt
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tin-tuyen-dung-${tab}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
