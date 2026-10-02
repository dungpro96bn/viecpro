'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  REPORT_DECISION_LABEL,
  REPORT_DECISIONS,
  REPORT_REASON_LABEL,
  REPORT_REASONS,
  REPORT_SEVERITY_LABEL,
  REPORT_SEVERITIES,
  REPORT_STATUS_LABEL,
  REPORT_TARGET_LABEL,
  type AdminReportDetail,
  type AdminReportItem,
  type AdminReportList,
  type ReportDecision,
  type ReportReason,
  type ReportSeverity,
  type ReportTab,
  type ReportTarget,
} from '@viecpro/shared';
import Drawer from '@/components/list/Drawer';
import FilterSelect from '@/components/list/FilterSelect';
import Pagination from '@/components/list/Pagination';
import { avatarTone, dateTime, errorText, relativeTime } from '@/components/list/list-utils';
import { useDebounced } from '@/components/list/useDebounced';
import { useShell } from '@/components/layout/AdminShell';
import { IconArrowRight, IconCheck, IconClock, IconExternal, IconFlag, IconSearch, IconUserCheck } from '@/components/ui/Icons';
import { api, post, WEB_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx, formatNumber, initials } from '@/lib/format';

const PAGE_SIZE = 20;
const TABS: Array<{ key: ReportTab; label: string }> = [
  { key: 'open', label: 'Cần xử lý' },
  { key: 'resolved', label: 'Đã xử lý' },
  { key: 'dismissed', label: 'Đã bỏ qua' },
];
const TARGETS: Array<{ key: ReportTarget | ''; label: string }> = [
  { key: '', label: 'Tất cả' },
  { key: 'job', label: 'Tin đăng' },
  { key: 'employer', label: 'Công ty' },
  { key: 'recruiter', label: 'NTD cá nhân' },
  { key: 'user', label: 'Ứng viên' },
];
const REASON_OPTIONS = [{ value: '' as const, label: 'Tất cả' }, ...REPORT_REASONS.map((r) => ({ value: r, label: REPORT_REASON_LABEL[r] }))] as Array<{ value: ReportReason | ''; label: string }>;
/** Quyết định cần mã 2FA + quyền users.lock */
const LOCKING: ReportDecision[] = ['suspend', 'ban'];
const DECISION_HINT: Record<ReportDecision, string> = {
  dismiss: 'Không đủ căn cứ vi phạm. Tin bị tự ẩn vì báo cáo thu phí sẽ hiện lại.',
  warn: 'Gửi cảnh cáo tới bên bị báo cáo, ghi vào lịch sử vi phạm.',
  remove_job: 'Đóng và gỡ tin, nhà tuyển dụng không tự mở lại được.',
  suspend: 'Tạm khoá: ẩn mọi tin, khoá thành viên của nhà tuyển dụng (hoặc khoá tài khoản ứng viên).',
  ban: 'Khoá vĩnh viễn tài khoản vi phạm nghiêm trọng.',
};

/** "Còn 2 giờ" / "Quá hạn 1 giờ" */
function dueText(minutes: number | null): string {
  if (minutes === null) return '—';
  const abs = Math.abs(minutes);
  const span = abs < 60 ? `${abs} phút` : abs < 1440 ? `${Math.round(abs / 60)} giờ` : `${Math.round(abs / 1440)} ngày`;
  return minutes < 0 ? `Quá hạn ${span}` : `Còn ${span}`;
}

/** Báo cáo vi phạm (design-new 11 – A-06): gộp theo đối tượng, ưu tiên mức độ × hạn xử lý */
export default function ReportsView() {
  const { refreshBadges } = useShell();
  const [tab, setTab] = useState<ReportTab>('open');
  const [target, setTarget] = useState<ReportTarget | ''>('');
  const [severity, setSeverity] = useState<ReportSeverity | ''>('');
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminReportList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ tab, page: String(page), limit: String(PAGE_SIZE) });
      if (target) p.set('target', target);
      if (severity) p.set('severity', severity);
      if (reason) p.set('reason', reason);
      if (mine) p.set('mine', 'true');
      if (q) p.set('q', q);
      setData(await api<AdminReportList>(`/admin/reports?${p.toString()}`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [tab, target, severity, reason, mine, q, page]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setPage(1), [q]);
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const claim = async (item: AdminReportItem) => {
    setClaiming(item.id);
    setError(null);
    try {
      await post(`/admin/reports/${item.id}/claim`);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setClaiming(null);
    }
  };
  const s = data?.stats;

  return (
    <>
      <header className="page-header page-header--list">
        <span className="page-header__titles">
          <span className="page-header__meta">Bảng điều khiển / Vận hành</span>
          <h1 className="page-header__title">Báo cáo vi phạm</h1>
        </span>
        <div className="page-header__actions">
          <label className="list-search">
            <IconSearch size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mã báo cáo, tên đối tượng…" aria-label="Tìm báo cáo" />
          </label>
          <button type="button" aria-pressed={mine} className={cx('chip-toggle', mine && 'chip-toggle--on')} onClick={() => filter(setMine)(!mine)}>
            <IconUserCheck size={14} />
            Chỉ việc của tôi
          </button>
        </div>
      </header>

      <div className="page-body">
        <section className="lkpis" aria-label="Tình hình xử lý">
          <article className="lkpi">
            <span className="lkpi__label">Cần xử lý</span>
            <b className="lkpi__value">{s ? formatNumber(s.open) : '—'}</b>
            <span className="lkpi__note">{s ? `+${formatNumber(s.openToday)} báo cáo 24 giờ qua` : ' '}</span>
          </article>
          <article className={cx('lkpi', !!s?.overdue && 'lkpi--accent')}>
            <span className="lkpi__label">Quá hạn xử lý</span>
            <b className="lkpi__value">{s ? formatNumber(s.overdue) : '—'}</b>
            <span className={cx('lkpi__note', s?.overdue ? 'lkpi__note--bad' : 'lkpi__note--good')}>{s?.overdue ? 'cần ưu tiên ngay' : 'Đúng hạn'}</span>
          </article>
          <article className="lkpi">
            <span className="lkpi__label">Thời gian xử lý TB</span>
            <b className="lkpi__value">{s?.avgHandleHours != null ? `${String(s.avgHandleHours).replace('.', ',')} giờ` : '—'}</b>
            <span className="lkpi__note">7 ngày gần nhất</span>
          </article>
          <article className="lkpi">
            <span className="lkpi__label">Vi phạm được xác nhận</span>
            <b className="lkpi__value">{s?.confirmedRate != null ? `${s.confirmedRate}%` : '—'}</b>
            <span className="lkpi__note">{s?.confirmedRate != null ? `${100 - s.confirmedRate}% báo cáo sai · 30 ngày` : 'Chưa có dữ liệu 30 ngày'}</span>
          </article>
        </section>

        {error && <p className="alert alert--danger" role="alert">{error}</p>}

        <section className="list-card" aria-label="Báo cáo vi phạm">
          <div className="tabs" role="tablist" aria-label="Trạng thái báo cáo">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={cx('tabs__item', tab === t.key && 'tabs__item--active')} onClick={() => filter(setTab)(t.key)}>
                {t.label}
                <span className="tabs__count">{data ? formatNumber(data.tabs[t.key]) : '…'}</span>
              </button>
            ))}
          </div>
          <div className="filters">
            {TARGETS.map((t) => (
              <button key={t.key || 'all'} type="button" aria-pressed={target === t.key} className={cx('chip-toggle', target === t.key && 'chip-toggle--on')} onClick={() => filter(setTarget)(t.key)}>
                {t.label}
              </button>
            ))}
            <span className="filters__divider" />
            <span className="rp-filter-label">Mức độ</span>
            {REPORT_SEVERITIES.map((sv) => (
              <button key={sv} type="button" aria-pressed={severity === sv} className={cx('chip-toggle', severity === sv && 'chip-toggle--on')} onClick={() => filter(setSeverity)(severity === sv ? '' : sv)}>
                <i className={cx('chip-toggle__dot', `rp-dot--${sv}`)} />
                {REPORT_SEVERITY_LABEL[sv]}
              </button>
            ))}
            <span className="filters__end">
              <FilterSelect label="Lý do" value={reason} options={REASON_OPTIONS} onChange={filter(setReason)} />
            </span>
          </div>
          <p className="rp-sort">Sắp xếp: <b>{tab === 'open' ? 'Ưu tiên (mức độ × hạn xử lý)' : 'Xử lý gần nhất'}</b></p>

          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Đối tượng bị báo cáo</th>
                  <th>Lý do</th>
                  <th>Người báo cáo</th>
                  <th>{tab === 'open' ? 'Hạn xử lý' : 'Kết quả'}</th>
                  <th>Phụ trách</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={6}>
                          <span className="skeleton dtable__skeleton" />
                        </td>
                      </tr>
                    ))
                  : data?.items.map((r) => <ReportRow key={r.id} r={r} claiming={claiming === r.id} onClaim={() => void claim(r)} onOpen={() => setSelectedId(r.id)} />)}
              </tbody>
            </table>
            {data && !data.items.length && (
              <div className="list-empty">
                <IconFlag size={26} />
                <b>{tab === 'open' ? 'Không còn báo cáo cần xử lý' : 'Chưa có báo cáo'}</b>
                {target || severity || reason || mine || q ? 'Thử bỏ bớt bộ lọc.' : 'Báo cáo mới từ người dùng sẽ hiện ở đây.'}
              </div>
            )}
          </div>
          {data && <Pagination page={data.page} limit={data.limit} total={data.total} unit="vụ báo cáo" onPage={setPage} />}
        </section>
      </div>

      <ReportDrawer
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={async () => {
          await Promise.all([load(), refreshBadges()]);
        }}
      />
    </>
  );
}

function ReportRow({ r, claiming, onClaim, onOpen }: { r: AdminReportItem; claiming: boolean; onClaim: () => void; onOpen: () => void }) {
  const { can } = useAuth();
  const active = r.status === 'open' || r.status === 'investigating';
  return (
    <tr className={cx(r.dueMinutes !== null && r.dueMinutes < 0 && 'rp-row--late')}>
      <td data-label="Đối tượng">
        <span className="who__text rp-target">
          <span className="who__name">
            {r.targetName}
            <span className={cx('mini-tag', `rp-sev--${r.severity}`)}>{REPORT_SEVERITY_LABEL[r.severity]}</span>
            {r.repeatOffender && <span className="mini-tag mini-tag--danger">Tái phạm</span>}
          </span>
          <span className="who__sub">{r.targetMeta}</span>
        </span>
      </td>
      <td data-label="Lý do">
        <span className="cell rp-reason">
          <span className="cell__main">{r.reasonLabel}</span>
          {r.detail && <span className="cell__sub">{r.detail}</span>}
        </span>
      </td>
      <td data-label="Người báo cáo">
        <span className="rp-reporters">
          <span className="avatar-stack">
            {r.reporterInitials.map((ini, i) => (
              <span key={i} className={cx('avatar avatar--sm', ini === 'KH' ? 'avatar--gray' : `avatar--${avatarTone(ini + i)}`)} title={ini === 'KH' ? 'Khách' : undefined}>
                {ini}
              </span>
            ))}
          </span>
          <span className="cell__sub">{r.reporterCount} báo cáo</span>
        </span>
      </td>
      <td data-label="Hạn xử lý / kết quả">
        {active ? (
          <span className="cell">
            <span className={cx('cell__main rp-due', r.dueMinutes !== null && r.dueMinutes < 0 && 'rp-due--late', r.dueMinutes !== null && r.dueMinutes >= 0 && r.dueMinutes < 120 && 'rp-due--soon')}>
              <IconClock size={13} />
              {dueText(r.dueMinutes)}
            </span>
            <span className="cell__sub">Mở {relativeTime(r.createdAt).toLowerCase()}</span>
          </span>
        ) : (
          <span className="cell">
            <span className="cell__main">{r.decision ? REPORT_DECISION_LABEL[r.decision] : REPORT_STATUS_LABEL[r.status]}</span>
            <span className="cell__sub">{r.resolvedAt && relativeTime(r.resolvedAt)}</span>
          </span>
        )}
      </td>
      <td data-label="Phụ trách">
        {r.assignee ? (
          <span className="rp-assignee">
            <span className={cx('avatar avatar--sm', `avatar--${avatarTone(r.assignee.id)}`)}>{initials(r.assignee.name)}</span>
            {r.assignee.isMe ? 'Bạn' : r.assignee.name}
          </span>
        ) : active && can('jobs.moderate') ? (
          <button type="button" className="row-btn row-btn--primary" disabled={claiming} onClick={onClaim}>
            {claiming ? <span className="spinner" /> : 'Nhận xử lý'}
          </button>
        ) : (
          <span className="cell__sub">—</span>
        )}
      </td>
      <td data-label="Thao tác">
        <button type="button" className="row-btn" onClick={onOpen}>
          Xem chi tiết
          <IconArrowRight size={13} />
        </button>
      </td>
    </tr>
  );
}

/** Ngăn kéo vụ báo cáo: các báo cáo gộp, đối tượng, nhận xử lý, quyết định (khoá cần mã 2FA) */
function ReportDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const { can } = useAuth();
  const [detail, setDetail] = useState<AdminReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<ReportDecision>('dismiss');
  const [note, setNote] = useState('');
  const [otp, setOtp] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    setDone(null);
    setDecision('dismiss');
    setNote('');
    setOtp('');
    if (!id) return;
    api<AdminReportDetail>(`/admin/reports/${id}`)
      .then(setDetail)
      .catch((e: unknown) => setError(errorText(e)));
  }, [id]);

  const run = async (fn: () => Promise<AdminReportDetail>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      setDetail(await fn());
      setDone(message);
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const active = detail && (detail.status === 'open' || detail.status === 'investigating');
  const takenByOther = !!detail?.assignee && !detail.assignee.isMe;
  const needsLock = LOCKING.includes(decision);
  const options = REPORT_DECISIONS.filter((d) => (d === 'remove_job' ? detail?.targetType === 'job' : true)).filter((d) => !LOCKING.includes(d) || can('users.lock'));
  const noteMissing = decision !== 'dismiss' && note.trim().length < 5;

  return (
    <Drawer
      open={!!id}
      title={detail?.targetName ?? 'Báo cáo vi phạm'}
      subtitle={detail?.targetMeta}
      onClose={onClose}
      footer={
        active &&
        can('jobs.moderate') &&
        !takenByOther &&
        (detail.assignee ? (
          <button
            type="button"
            className={cx('btn', needsLock ? 'btn--danger-solid' : 'btn--primary')}
            disabled={busy || noteMissing}
            onClick={() =>
              void run(
                () => post<AdminReportDetail>(`/admin/reports/${detail.id}/decide`, { decision, ...(note.trim() && { note: note.trim() }), ...(needsLock && otp && { otp }) }),
                `Đã xử lý: ${REPORT_DECISION_LABEL[decision]}. Người báo cáo đã được thông báo kết quả.`,
              )
            }
          >
            {busy ? <span className="spinner" /> : <IconCheck size={15} />}
            Xác nhận quyết định
          </button>
        ) : (
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void run(() => post<AdminReportDetail>(`/admin/reports/${detail.id}/claim`), 'Bạn đã nhận xử lý vụ này.')}>
            <IconUserCheck size={15} />
            Nhận xử lý
          </button>
        ))
      }
    >
      {error && <p className="alert alert--danger" role="alert">{error}</p>}
      {done && <p className="list-notice" role="status"><IconCheck size={16} />{done}</p>}
      {!detail && !error && <span className="skeleton rp-drawer-skeleton" aria-busy="true" />}
      {detail && (
        <>
          <div className="dgrid">
            <span className="dgrid__item">
              <small>Mức độ</small>
              <b>
                <span className={cx('mini-tag', `rp-sev--${detail.severity}`)}>{REPORT_SEVERITY_LABEL[detail.severity]}</span>
                {detail.repeatOffender && <span className="mini-tag mini-tag--danger rp-gap">Tái phạm</span>}
              </b>
            </span>
            <span className="dgrid__item">
              <small>Trạng thái</small>
              <b>{detail.decision ? `${REPORT_STATUS_LABEL[detail.status]} · ${REPORT_DECISION_LABEL[detail.decision]}` : REPORT_STATUS_LABEL[detail.status]}</b>
            </span>
            <span className="dgrid__item">
              <small>Hạn xử lý</small>
              <b className={cx(detail.dueMinutes !== null && detail.dueMinutes < 0 && 'rp-due--late')}>{detail.dueAt ? `${dueText(detail.dueMinutes)} · ${dateTime(detail.dueAt)}` : '—'}</b>
            </span>
            <span className="dgrid__item">
              <small>Phụ trách</small>
              <b>{detail.assignee ? (detail.assignee.isMe ? 'Bạn' : detail.assignee.name) : 'Chưa có người nhận'}</b>
            </span>
          </div>

          <section className="dsec">
            <span className="dsec__title">Đối tượng</span>
            <div className="rp-target-box">
              <span className="dlist__text">
                <b>{detail.target.name}</b>
                <small>
                  {REPORT_TARGET_LABEL[detail.target.type]}
                  {detail.target.status && ` · ${detail.target.status === 'suspended' || detail.target.status === 'locked' ? 'Đang bị khoá' : detail.target.status === 'paused' ? 'Đang tạm ẩn' : detail.target.status === 'closed' ? 'Đã đóng' : 'Đang hoạt động'}`}
                  {` · ${detail.target.previousViolations} vi phạm đã xác nhận trước đây`}
                </small>
              </span>
              {detail.target.link && (
                <a className="row-btn" href={`${WEB_URL}${detail.target.link}`} target="_blank" rel="noreferrer">
                  Mở tin
                  <IconExternal size={13} />
                </a>
              )}
            </div>
          </section>

          <section className="dsec">
            <span className="dsec__title">{detail.reports.length} báo cáo trong vụ này</span>
            <ul className="dlist">
              {detail.reports.map((r) => (
                <li key={r.code} className="rp-report">
                  <span className="dlist__text">
                    <b>
                      {r.code} · {r.reason}
                    </b>
                    {r.detail && <span className="rp-report__detail">“{r.detail}”</span>}
                    <small>
                      {r.reporter}
                      {r.contact && ` · ${r.contact}`} · {dateTime(r.createdAt)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
            <span className="rp-hint">Bên bị báo cáo không biết danh tính người báo cáo.</span>
          </section>

          {detail.decisionNote && <p className="dnote">Ghi chú xử lý: {detail.decisionNote}</p>}

          {active && can('jobs.moderate') && (
            <section className="dsec">
              <span className="dsec__title">Quyết định</span>
              {takenByOther ? (
                <p className="dnote">{detail.assignee?.name} đang xử lý vụ này.</p>
              ) : !detail.assignee ? (
                <p className="rp-hint">Nhận xử lý để ghi quyết định (tránh hai người cùng xử lý một vụ).</p>
              ) : (
                <>
                  <div className="rp-decisions" role="radiogroup" aria-label="Quyết định">
                    {options.map((d) => (
                      <button key={d} type="button" role="radio" aria-checked={decision === d} className={cx('rp-decision', decision === d && 'rp-decision--on', LOCKING.includes(d) && 'rp-decision--danger')} onClick={() => setDecision(d)}>
                        <b>{REPORT_DECISION_LABEL[d]}</b>
                        <span>{DECISION_HINT[d]}</span>
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    <span className="field__label">Ghi chú xử lý {decision !== 'dismiss' && <span className="rp-req">*</span>}</span>
                    <textarea className="field__input field__input--area" value={note} maxLength={500} placeholder={decision === 'dismiss' ? 'Không bắt buộc' : 'Lý do – gửi cho bên bị báo cáo'} onChange={(e) => setNote(e.target.value)} />
                  </label>
                  {needsLock && (
                    <label className="field">
                      <span className="field__label">Mã 2FA xác nhận</span>
                      <input className="field__input dialog__otp" value={otp} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 số từ ứng dụng xác thực" onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
                    </label>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </Drawer>
  );
}
